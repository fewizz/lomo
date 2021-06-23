#include frex:shaders/api/header.glsl
#extension GL_ARB_explicit_attrib_location : require
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl

// lomo:post.frag

uniform sampler2D u_reflective;
uniform sampler2D u_sorted;
uniform sampler2D u_sorted_depth;
uniform sampler2D u_sorted_without_translucent;
uniform sampler2D u_sorted_without_translucent_depth;
uniform sampler2D u_translucent;

in vec2 vs_uv;
out vec4 out_color;

#define TRAVERSAL_SUCCESS 0
#define TRAVERSAL_UNDER 1
#define TRAVERSAL_OUT_OF_FB 2
#define TRAVERSAL_TOO_LONG 3

struct fb_traversal_result {
	int code;
	ivec2 pos;
	float z;
};

const int last_level = 4;

const int power = 2;
const int cell_size = 1 << power;

int current_size(int lod) {
	return 1 << (power*lod);
}

struct cell_pos {
	ivec2 outer;
	vec2 inner;
	float z;
	vec2 t;
};

void cell_pos_init(inout cell_pos pos, vec2 dir, int ival) {
	ivec2 axis_path_outer = -(pos.outer & (ival - 1));
	
	if(dir.x > 0.0) axis_path_outer.x += ival;
	if(dir.y > 0.0) axis_path_outer.y += ival;
	
	vec2 dist_per_axis_path = vec2(1.0) / dir;
	vec2 axis_path = vec2(axis_path_outer) - pos.inner;
	pos.t = dist_per_axis_path * axis_path;
}

float next_cell_dist(cell_pos pos) {
	return pos.t.x < pos.t.y ? pos.t.x : pos.t.y;
}

float next_cell(inout cell_pos pos, vec2 dir, int lod) {
	int ival = current_size(lod);
	float fval = float(ival);
	vec2 s = sign(dir);
	float dist = 0.0;
	
	if(pos.t.x < pos.t.y) {
		float du_path = dir.y * pos.t.x + pos.inner.y;
		
		pos.outer.x += -(pos.outer.x % ival) + (dir.x > 0.0 ? ival : - 1);
		pos.outer.y += int(floor(du_path));
		
		pos.inner.x = (-s.x + 1.0) / 2.0;
		pos.inner.y = fract(du_path);
		
		dist = pos.t.x;
		pos.t.y -= dist;
		pos.t.x = fval / (s.x * dir.x);
	}
	else if(pos.t.y < pos.t.x) {
		float lr_path = dir.x * pos.t.y + pos.inner.x;
		
		pos.outer.y += -(pos.outer.y % ival) + (dir.y > 0.0 ? ival : - 1);
		pos.outer.x += int(floor(lr_path));
		
		pos.inner.y = (-s.y + 1.0) / 2.0;
		pos.inner.x = fract(lr_path);
		
		dist = pos.t.y;
		pos.t.x -= dist;
		pos.t.y = fval / (s.y * dir.y);
	}
	else {
		pos.outer.y += -(pos.outer.y % ival) + (dir.y > 0.0 ? ival : - 1);
		pos.outer.x += -(pos.outer.x % ival) + (dir.x > 0.0 ? ival : - 1);
		
		pos.inner.y = (-s.y + 1.0) / 2.0;
		pos.inner.x = (-s.x + 1.0) / 2.0;
		
		dist = pos.t.x;
		pos.t.x = fval / (s.x * dir.x);
		pos.t.y = fval / (s.y * dir.y);
	}

	return dist;
}

// finds farthest pixel z point in window space
// for camera-space position, normal
float farthest_z(
	// fract(position) should be == vec3(0.5)
	vec3 position,
	vec3 normal,
	mat4 proj
) {
	vec3 x = vec3(
		1, 0, -normal.x/normal.z
	);

	vec3 y = vec3(
		0, 1, -normal.y/normal.z
	);

	vec3 x_ws = cam_dir_to_win(position, x, proj);
	vec3 y_ws = cam_dir_to_win(position, y, proj);

	return max4(
		plane_z(x_ws, y_ws, vec2(-0.5, -0.5)),
		plane_z(x_ws, y_ws, vec2(-0.5,  0.5)),
		plane_z(x_ws, y_ws, vec2( 0.5, -0.5)),
		plane_z(x_ws, y_ws, vec2( 0.5,  0.5))
	);
}

struct ref_ctx {
	cell_pos pos;
	int lod;
	vec2 dir_xy;
	float lower_depth;
	float upper_depth;
};

float depth_value(ivec2 pos, int lod, sampler2D s) {
	return texelFetch(s, pos >> (power*lod), lod).r;
}

float upper_depth_value(ref_ctx ctx, sampler2D s) {
	if(ctx.lod < last_level)
		return depth_value(ctx.pos.outer, ctx.lod + 1, s);
	return 0.0;
}

float lower_depth_value(ref_ctx ctx, sampler2D s) {
	return depth_value(ctx.pos.outer, ctx.lod, s);
}

void lod_increase(inout ref_ctx ctx, sampler2D s) {
	++ctx.lod;
	cell_pos_init(ctx.pos, ctx.dir_xy, current_size(ctx.lod));
	ctx.lower_depth = ctx.upper_depth;
	ctx.upper_depth = upper_depth_value(ctx, s);
}

void lod_decrease(inout ref_ctx ctx, sampler2D s) {
	--ctx.lod;
	cell_pos_init(ctx.pos, ctx.dir_xy, current_size(ctx.lod));
	ctx.upper_depth = ctx.lower_depth;
	ctx.lower_depth = lower_depth_value(ctx, s);
}

void find_lowest_lod(inout ref_ctx ctx, sampler2D s) {
	while(ctx.lod > 0 && ctx.pos.z >= ctx.lower_depth)
		lod_decrease(ctx, s);
}

void find_uppest_lod(inout ref_ctx ctx, sampler2D s) {
	while(ctx.lod < last_level && ctx.pos.z < ctx.upper_depth)
		lod_increase(ctx, s);
}

bool is_out_of_fb(cell_pos pos) {
	return
		any(lessThan(pos.outer, ivec2(0))) ||
		any(greaterThanEqual(pos.outer, frxu_size.xy)) ||
		pos.z < 0 || pos.z > 1;
}

fb_traversal_result traverse_fb(vec3 dir, vec3 pos_ws, sampler2D s) {
	dir = avoid_zero_components(dir);

	ref_ctx ctx = ref_ctx(
		cell_pos(ivec2(pos_ws.xy), vec2(0.5), pos_ws.z, vec2(0.0)),
		0,
		normalize(dir.xy),
		0.0,
		0.0
	);
	cell_pos_init(ctx.pos, ctx.dir_xy, current_size(ctx.lod));
	ctx.upper_depth = upper_depth_value(ctx, s);
	ctx.lower_depth = lower_depth_value(ctx, s);

	find_uppest_lod(ctx, s);

	bool backwards = dir.z <= 0.0;
	float dir_xy_length = length(dir.xy);
	float dir_z_per_xy = dir.z / dir_xy_length;

	int steps = 0;

	while(true) {
		cell_pos next = ctx.pos;
		float dist = next_cell(next, ctx.dir_xy, ctx.lod);
		next.z += dist * dir_z_per_xy;

		bool collides = ctx.pos.z >= ctx.lower_depth || next.z >= ctx.lower_depth;

		if(collides) {
			if(ctx.lod == 0) break;

			float mul = (ctx.lower_depth - ctx.pos.z) / (next.z - ctx.pos.z);

			lod_decrease(ctx, s);

			if(!backwards && mul > 0.0 && mul < 1.0) {
				dist *= mul;
				float dist0 = 0.0;

				while(next_cell_dist(ctx.pos) < dist - dist0)
					dist0 += next_cell(ctx.pos, ctx.dir_xy, ctx.lod);

				ctx.pos.z += dist0 * dir_z_per_xy;
				ctx.lower_depth = lower_depth_value(ctx, s);
			}
		}
		else {
			cell_pos prev = ctx.pos;
			ctx.pos = next;

			ctx.lower_depth = lower_depth_value(ctx, s);

			if((prev.outer / cell_size) != (next.outer / cell_size)) {
				ctx.upper_depth = upper_depth_value(ctx, s);

				find_uppest_lod(ctx, s);
				find_lowest_lod(ctx, s);
			}
		}

		if(is_out_of_fb(ctx.pos)) {
			return fb_traversal_result(TRAVERSAL_OUT_OF_FB, ivec2(0), 0.0);
		}

		if(++steps == 100) {
			return fb_traversal_result(TRAVERSAL_TOO_LONG, ivec2(0), 0.0);
		}
	}

	return fb_traversal_result(
		TRAVERSAL_SUCCESS,
		ctx.pos.outer,
		ctx.pos.z
	);
}

void main() {
	vec4 color = vec4(0);
	float ratio = 0.0;
	
	vec4 packed_normal = texture2D(u_reflective, vs_uv);
	vec4 color0 = texture(u_sorted, vs_uv);
	vec4 tr = texture(u_translucent, vs_uv);

	if(packed_normal.a != 0) {
		vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float depth_ws = texelFetch(u_sorted_depth, ivec2(gl_FragCoord.xy), 0).r ;
		vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
		vec3 position_cs = win_to_cam(position_ws, proj);
		vec3 incidence_cs = normalize(position_cs);
		vec3 normal_cs = raw_normal_to_cam(normal, view);

		vec3 reflection_dir = reflect(incidence_cs, normal_cs);
		vec3 dir_ws = cam_dir_to_win(position_cs, reflection_dir, proj);

		// applying z offset, dumb'ish
		float z_per_xy = dir_ws.z / length(dir_ws.xy);
		position_ws.z -= abs(z_per_xy)*3;

		fb_traversal_result res = traverse_fb(dir_ws, position_ws, u_sorted_depth);

		if(res.code == TRAVERSAL_SUCCESS) {
			color = texelFetch(u_sorted, res.pos, 0);
		}

		float n1 = 1.0;
		float n2 = 1.3333;
		vec3 refraction_dir = refract(incidence_cs, normal_cs, n1 / n2);
		dir_ws = cam_dir_to_win(position_cs, refraction_dir, proj);
		res = traverse_fb(dir_ws, position_ws, u_sorted_without_translucent_depth);

		if(res.code == TRAVERSAL_SUCCESS) {
			color0 = texelFetch(u_sorted_without_translucent, res.pos, 0);
		}

		float cosi = abs(dot(normal_cs, reflection_dir));
		float cost = abs(dot(-normal_cs, refraction_dir));

		float refl_coeff =
			pow((n1*cosi - n2*cost) / (n1*cosi + n2*cost), 2.0)
			+
			pow((n2*cosi - n1*cost) / (n2*cosi + n1*cost), 2.0);
			
		refl_coeff /= 2.0;

		float refr_coeff =
			pow(2.0 * n1*cosi / (n1 * cosi + n2 * cost), 2.0)
			+
			pow(2.0 * n1*cosi / (n2 * cosi + n1 * cost), 2.0);
		refr_coeff /= 2.0;

		ratio = refl_coeff / (refl_coeff + refr_coeff);
	}

	out_color = mix(color0, color, ratio);
}