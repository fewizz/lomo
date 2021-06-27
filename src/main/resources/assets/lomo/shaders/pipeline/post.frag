#include frex:shaders/api/header.glsl
#extension GL_ARB_explicit_attrib_location : require
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl
#include frex:shaders/api/view.glsl

// lomo:post.frag

uniform sampler2D u_solid;
uniform sampler2D u_solid_normal;
uniform sampler2D u_solid_depth;
uniform sampler2D u_sorted;
uniform sampler2D u_sorted_normal;
uniform sampler2D u_sorted_depth;

in vec2 vs_uv;

layout(location = 0) out vec4 out_color;
layout(location = 1) out vec4 out_lag_finder;

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

float next_cell_ru(inout cell_pos pos, vec2 dir, int lod) {
	int ival = current_size(lod);
	float fval = float(ival);
	float dist = 0.0;
	
	if(pos.t.x < pos.t.y) {
		float du_path = dir.y * pos.t.x + pos.inner.y;
		pos.outer += ivec2( -(pos.outer.x % ival) + ival, int(du_path) );
		pos.inner = vec2( 0.0, fract(du_path) );
		dist = pos.t.x;
		pos.t = vec2(fval / dir.x, pos.t.y - pos.t.x);
	}
	else if(pos.t.y < pos.t.x) {
		float lr_path = dir.x * pos.t.y + pos.inner.x;
		pos.outer += ivec2( int(lr_path), -(pos.outer.y % ival) + ival );
		pos.inner = vec2( fract(lr_path), 0.0 );
		dist = pos.t.y;
		pos.t = vec2(pos.t.x - pos.t.y, fval / dir.y);
	}
	else {
		pos.outer += -(pos.outer % ival) + ival;
		pos.inner = vec2(0.0);
		dist = pos.t.x;
		pos.t = fval / dir;
	}

	return dist;
}

float next_cell_rd(inout cell_pos pos, vec2 dir, int lod) {
	int ival = current_size(lod);
	float fval = float(ival);
	float dist = 0.0;
	
	if(pos.t.x < pos.t.y) {
		float du_path = dir.y * pos.t.x + pos.inner.y;
		pos.outer += ivec2( -(pos.outer.x % ival) + ival, int(floor(du_path)) );
		pos.inner = vec2(0.0, fract(du_path));
		dist = pos.t.x;
		pos.t = vec2(fval / dir.x, pos.t.y - pos.t.x);
	}
	else if(pos.t.y < pos.t.x) {
		float lr_path = dir.x * pos.t.y + pos.inner.x;
		pos.outer += ivec2( int(floor(lr_path)), -(pos.outer.y % ival) - 1 );
		pos.inner = vec2(fract(lr_path), 1.0);
		dist = pos.t.y;
		pos.t = vec2(pos.t.x - pos.t.y, fval / -dir.y);
	}
	else {
		pos.outer -= pos.outer % ival;
		pos.outer += ivec2( ival, - 1 );
		pos.inner = vec2(0.0, 1.0);
		dist = pos.t.x;
		pos.t = fval / vec2(dir.x, -dir.y);
	}

	return dist;
}

float next_cell_lu(inout cell_pos pos, vec2 dir, int lod) {
	int ival = current_size(lod);
	float fval = float(ival);
	float dist = 0.0;
	
	if(pos.t.x < pos.t.y) {
		float du_path = dir.y * pos.t.x + pos.inner.y;
		pos.outer += ivec2( -(pos.outer.x % ival) + -1, int(floor(du_path)) );
		pos.inner = vec2( 1.0, fract(du_path) );
		dist = pos.t.x;
		pos.t = vec2( fval / -dir.x, pos.t.y - pos.t.x ) ;
	}
	else if(pos.t.y < pos.t.x) {
		float lr_path = dir.x * pos.t.y + pos.inner.x;
		pos.outer += ivec2( int(floor(lr_path)), -(pos.outer.y % ival) + ival );
		pos.inner = vec2(fract(lr_path), 0.0);
		dist = pos.t.y;
		pos.t = vec2(pos.t.x - pos.t.y, fval / dir.y);
	}
	else {
		pos.outer -= pos.outer % ival;
		pos.outer += ivec2(-1, ival);
		pos.inner = vec2(1.0, 0.0);
		dist = pos.t.x;
		pos.t = fval / vec2(dir.y, -dir.x);
	}

	return dist;
}

float next_cell_ld(inout cell_pos pos, vec2 dir, int lod) {
	int ival = current_size(lod);
	float fval = float(ival);
	float dist = 0.0;
	
	if(pos.t.x < pos.t.y) {
		float du_path = dir.y * pos.t.x + pos.inner.y;
		pos.outer += ivec2( -(pos.outer.x % ival) - 1, int(floor(du_path)) );
		pos.inner = vec2( 1.0, fract(du_path) );
		dist = pos.t.x;
		pos.t = vec2( -fval / dir.x, pos.t.y - pos.t.x );
	}
	else if(pos.t.y < pos.t.x) {
		float lr_path = dir.x * pos.t.y + pos.inner.x;
		pos.outer += ivec2( int(floor(lr_path)), -(pos.outer.y % ival) - 1 );
		pos.inner = vec2( fract(lr_path), 1.0 );
		dist = pos.t.y;
		pos.t = vec2( pos.t.x - pos.t.y, -fval / dir.y );
	}
	else {
		pos.outer += -(pos.outer % ival) - 1;
		pos.inner = vec2(1.0);
		dist = 0.0;
		pos.t = -fval / dir;
	}

	return dist;
}

float next_cell_straight(inout cell_pos pos, vec2 dir, int lod) {
	int ival = current_size(lod);
	float fval = float(ival);
	float dist = 0.0;

	if(dir.x != 0.0) {
		dist = pos.t.x;
		pos.t.x = fval;
		pos.t.y = 100000000.;

		if(dir.x > 0.0) {
			pos.outer.x += ival - (pos.outer.x % ival);
			pos.inner.x = 0.0;
		}
		else {
			pos.outer.x -= (pos.outer.x % ival) + 1;
			pos.inner.x = 1.0;
		}
	}
	else {
		dist = pos.t.y;
		pos.t.y = fval;
		pos.t.x = 100000000.;

		if(dir.y > 0.0) {
			pos.outer.y += ival - (pos.outer.y % ival);
			pos.inner.y = 0.0;
		}
		else {
			pos.outer.y -= (pos.outer.y % ival) + 1;
			pos.inner.y = 1.0;
		}
	}

	return dist;
}

float depth_value(ivec2 pos, int lod, sampler2D s) {
	return texelFetch(s, pos >> (power*lod), lod).r;
}

#define UPPER_DEPTH_VALUE ( lod < last_level ? depth_value(pos.outer, lod + 1, s) : 0.0 )
#define LOWER_DEPTH_VALUE depth_value(pos.outer, lod, s)

#define LOD_INCREASE { \
	++lod; \
	cell_pos_init(pos, dir_xy, current_size(lod)); \
	lower_depth = upper_depth; \
	upper_depth = UPPER_DEPTH_VALUE; \
}

#define LOD_DECREASE { \
	--lod; \
	cell_pos_init(pos, dir_xy, current_size(lod)); \
	upper_depth = lower_depth; \
	lower_depth = LOWER_DEPTH_VALUE; \
}

#define FIND_LOWEST_LOD { \
	while(lod > 0 && pos.z >= lower_depth) \
		LOD_DECREASE \
}

#define FIND_UPPEST_LOD { \
	while(lod < last_level && pos.z < upper_depth) \
		LOD_INCREASE \
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

void guess(inout fb_traversal_result res, sampler2D sd, sampler2D sn) {
	vec4 packed_normal = texelFetch(sn, res.pos, 0);
	vec3 normal = normalize((packed_normal.xyz * 0.5) + 0.5);
	vec3 normal_cs = raw_normal_to_cam(normal, frx_viewMatrix());
	//vec3 pos = 
	//vec3 mid = (pos + next)/2.0;
	//vec2 mid_center_ws = floor(mid.xy) + vec2(0.5);
	vec3 normal_origin_ws = 
		vec3(
			vec2(res.pos) + vec2(0.5),
			res.z
		);
	vec3 normal_origin_cs = win_to_cam(normal_origin_ws, frx_projectionMatrix());

	float f = farthest_z(normal_origin_cs, normal_cs, frx_projectionMatrix());
	float d = texelFetch(sd, res.pos, 0).r;
	if(
		//length(packed_normal.xyz) > 0.5
		//&&
		//(
		//	res.z < res.z+f*4)
		//)
		res.z < d + f*4
	) {
		//return reflection_result(false, vec4(0), vec3(0), vec3(0));
		res.code = TRAVERSAL_SUCCESS;
	}
}

bool is_out_of_fb(cell_pos pos) {
	return
		any(lessThan(pos.outer, ivec2(0))) ||
		any(greaterThanEqual(pos.outer, frxu_size.xy)) ||
		pos.z < 0 || pos.z > 1;
}

#define TRAVERSE_FUNC(__name, __next_func) \
fb_traversal_result __name (vec3 dir, vec3 pos_ws, sampler2D s) { \
	cell_pos pos = cell_pos(ivec2(pos_ws.xy), vec2(0.5), pos_ws.z, vec2(0.0)); \
	int lod = 0; \
	vec2 dir_xy = normalize(dir.xy);\
	cell_pos_init(pos, dir_xy, current_size(lod)); \
	float upper_depth = UPPER_DEPTH_VALUE; \
	float lower_depth = LOWER_DEPTH_VALUE; \
	FIND_UPPEST_LOD \
	float dir_xy_length = length(dir.xy); \
	float dir_z_per_xy = dir.z / dir_xy_length; \
	bool backwards = dir.z < 0.0; \
	int steps = 0; \
	while(true) { \
		cell_pos next = pos; \
		float dist = __next_func (next, dir_xy, lod); \
		next.z += dist * dir_z_per_xy; \
		bool under = next.z >= lower_depth; \
		if(under) { \
			float mul = (lower_depth - pos.z) / (next.z - pos.z); \
			bool collides = !backwards && mul > 0.0 && mul < 1.0; \
			if(lod == 0) { \
				return fb_traversal_result(collides ? TRAVERSAL_SUCCESS : TRAVERSAL_UNDER, next.outer, next.z); \
			} \
			LOD_DECREASE \
			if(collides) { \
				dist *= mul; \
				float dist0 = 0.0; \
				int steps = 8; \
				while(--steps > 0 && next_cell_dist(pos) < dist - dist0) \
					dist0 += __next_func (pos, dir_xy, lod); \
				pos.z += dist0 * dir_z_per_xy; \
				lower_depth = LOWER_DEPTH_VALUE; \
			} \
		} \
		else { \
			cell_pos prev = pos; \
			pos = next; \
			lower_depth = LOWER_DEPTH_VALUE; \
			if((prev.outer / cell_size) != (next.outer / cell_size)) { \
				upper_depth = UPPER_DEPTH_VALUE; \
				FIND_UPPEST_LOD \
				FIND_LOWEST_LOD \
			} \
		} \
		if(is_out_of_fb(pos)) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, ivec2(0), 0.0); \
		if(++steps == 100) { \
			out_lag_finder = vec4(1.0, 0.0, 0.0, 0.0); \
			return fb_traversal_result(TRAVERSAL_TOO_LONG, ivec2(0), 0.0); \
		} \
	} \
}

TRAVERSE_FUNC(traverse_fb_ru, next_cell_ru)
TRAVERSE_FUNC(traverse_fb_rd, next_cell_rd)
TRAVERSE_FUNC(traverse_fb_lu, next_cell_lu)
TRAVERSE_FUNC(traverse_fb_ld, next_cell_ld)
TRAVERSE_FUNC(traverse_fb_straight, next_cell_straight)

fb_traversal_result traverse_fb(vec3 dir, vec3 pos, sampler2D s) {
	if(dir.x == 0.0 && dir.y == 0.0) {
		ivec2 ipos = ivec2(pos.xy);
		return fb_traversal_result(TRAVERSAL_SUCCESS, ipos, texelFetch(s, ipos, 0).r);
	}

	if(dir.x == 0.0 || dir.y == 0.0) return traverse_fb_straight(dir, pos, s);

	if(dir.x > 0.0) {
		if(dir.y > 0.0) return traverse_fb_ru(dir, pos, s);
		else return traverse_fb_rd(dir, pos, s);
	}
	else {
		if(dir.y > 0.0) return traverse_fb_lu(dir, pos, s);
		else return traverse_fb_ld(dir, pos, s);
	}
}

void main() {
	out_lag_finder = vec4(0.0, 0.0, 0.0, 0.0);
	vec4 color = vec4(0);
	float ratio = 0.0;
	
	vec4 normal4 = texture2D(u_sorted_normal, vs_uv);
	vec4 color0 = texture(u_sorted, vs_uv);

	if(normal4.a != 0.0) {
		vec3 normal = normal4.rgb * 2.0 - 1.0;//normalize((packed_normal.xyz - 0.5) * 2);
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
		if(res.code == TRAVERSAL_UNDER)
			guess(res, u_sorted_depth, u_sorted_normal);

		if(res.code == TRAVERSAL_SUCCESS) {
			color = texelFetch(u_sorted, res.pos, 0);
		}

		float n1 = frx_viewFlag(FRX_CAMERA_IN_FLUID) ? 1.3333 : 1.0;
		float n2 = frx_viewFlag(FRX_CAMERA_IN_FLUID) ? 1.0 : 1.3333;
		vec3 refraction_dir = refract(incidence_cs, normal_cs, n1 / n2);
		dir_ws = cam_dir_to_win(position_cs, refraction_dir, proj);
		res = traverse_fb(dir_ws, position_ws, u_solid_depth);
		if(res.code == TRAVERSAL_UNDER)
			guess(res, u_solid_depth, u_solid_normal);
		if(res.code == TRAVERSAL_SUCCESS) {
			color0 = texelFetch(u_solid, res.pos, 0);
		}

		float cosi = abs(dot(normal_cs, reflection_dir));
		float cost = abs(dot(-normal_cs, refraction_dir));

		float refl_coeff =
			pow((n1*cosi - n2*cost) / (n1*cosi + n2*cost), 2.0)
			+
			pow((n2*cosi - n1*cost) / (n2*cosi + n1*cost), 2.0);
			
		refl_coeff /= 2.0;

		/*float refr_coeff =
			pow(2.0 * n1*cosi / (n1 * cosi + n2 * cost), 2.0)
			+
			pow(2.0 * n1*cosi / (n2 * cosi + n1 * cost), 2.0);
		refr_coeff /= 2.0;*/

		ratio = refl_coeff;// / (refl_coeff + refr_coeff);
	}

	out_color = mix(color0, color, ratio);
}