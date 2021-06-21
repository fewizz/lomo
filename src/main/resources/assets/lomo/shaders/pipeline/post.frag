#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl

/* lomo:pipeline/post.frag */

uniform sampler2D u_reflective;

uniform sampler2D u_main;
uniform sampler2D u_depth;

in vec2 _cvv_texcoord;
out vec4 out_color;

struct reflection_result {
	bool success;
	vec4 color;
	vec3 position;
	vec3 normal;
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

float next_cell(inout cell_pos pos, vec2 dir, int ival) {
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

float depth_value(ivec2 pos, int lod) {
	return texelFetch(u_depth, pos >> (power*lod), lod).r;
}

float upper_depth_value(inout ref_ctx ctx) {
	if(ctx.lod < last_level)
		return depth_value(ctx.pos.outer, ctx.lod + 1);
	return 0.0;
}

float lower_depth_value(inout ref_ctx ctx) {
	return depth_value(ctx.pos.outer, ctx.lod);
}

void lod_increase(inout ref_ctx ctx) {
	++ctx.lod;
	cell_pos_init(ctx.pos, ctx.dir_xy, current_size(ctx.lod));
	ctx.lower_depth = ctx.upper_depth;
	ctx.upper_depth = upper_depth_value(ctx);
}

void lod_decrease(inout ref_ctx ctx) {
	--ctx.lod;
	cell_pos_init(ctx.pos, ctx.dir_xy, current_size(ctx.lod));
	ctx.upper_depth = ctx.lower_depth;
	ctx.lower_depth = lower_depth_value(ctx);
}

reflection_result reflection(vec3 dir, vec3 pos_ws) {
	// that's possible
	dir = avoid_zero_components(dir);

	ref_ctx ctx = ref_ctx(
		cell_pos(ivec2(pos_ws.xy), vec2(0.5), pos_ws.z, vec2(0.0)),
		0,
		normalize(dir.xy),
		0.0,
		0.0
	);
	cell_pos_init(ctx.pos, ctx.dir_xy, current_size(ctx.lod));
	ctx.lower_depth = lower_depth_value(ctx);
	ctx.upper_depth = upper_depth_value(ctx);

	bool backwards = dir.z <= 0.0;
	float dir_xy_length = length(dir.xy);
	float dir_z_per_xy = dir.z / dir_xy_length;

	int steps = 0;
	while(true) {
		while(ctx.lod > 0 && ctx.pos.z >= ctx.lower_depth)
			lod_decrease(ctx);

		while(ctx.lod < last_level && ctx.pos.z < ctx.upper_depth)
			lod_increase(ctx);

		while(true) {
			cell_pos next = ctx.pos;
			float dist = next_cell(next, ctx.dir_xy, current_size(ctx.lod));
			next.z += dist * dir_z_per_xy;

			bool collides = ctx.pos.z >= ctx.lower_depth || next.z >= ctx.lower_depth;

			if(!collides) {
				ctx.pos = next;
				ctx.lower_depth = lower_depth_value(ctx);
				ctx.upper_depth = upper_depth_value(ctx);
				break;
			};

			if(ctx.lod > 0) {
				lod_decrease(ctx);
				continue;
			}
			
			vec4 packed_normal = texelFetch(u_reflective, next.outer, 0);
			vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);

			vec3 normal_cs = raw_normal_to_cam(normal, frx_viewMatrix());

			return reflection_result(
				true,
				texelFetch(u_main, next.outer, 0),
				vec3(next.outer, next.z),
				normal_cs
			);
		}

		if(
			++steps > 200 ||
			any(lessThan(ctx.pos.outer, ivec2(0))) ||
			any(greaterThanEqual(ctx.pos.outer, frxu_size.xy)) ||
			ctx.pos.z < 0 || ctx.pos.z > 1
		) {
			return reflection_result(true, vec4(0.0, 0.0, 1.0, 1.0), vec3(0), vec3(0));
		}
	}
}

void main() {
	vec4 color = vec4(0);
	float ratio = 0;
	
	vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);
	if(packed_normal.a != 0) {
		vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float depth_ws = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r ;
		vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
		vec3 position_cs = win_to_cam(position_ws, proj);

		vec3 normal_cs = raw_normal_to_cam(normal, view);

		vec3 reflection_dir = reflect(normalize(position_cs), normal_cs);

		vec3 dir_ws = cam_dir_to_win(position_cs, reflection_dir, proj);

		// applying z offset, dumb'ish
		float z_per_xy = dir_ws.z / length(dir_ws.xy);
		position_ws.z -= abs(z_per_xy)*3;

		reflection_result res = reflection(dir_ws, position_ws);

		if(res.success) {
			color = res.color;
			/*vec2 p = abs((res.position.xy / frxu_size) * 2.0 - 1.0);
			float v = 1.0 - max(p.x, p.y);
			if(v > 0.5)
				ratio = 1;
			else
				ratio = smoothstep(0, 0.5, v);*/

			//ratio *= length(cross(reflection_dir, normal_cs));
			//ratio *= packed_normal.a;
			ratio = 1.0;
		}
	}

	out_color = mix(texture(u_main, _cvv_texcoord), color, ratio);
}