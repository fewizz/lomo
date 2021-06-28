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
	uvec2 pos;
	float z;
};

const uint power = 2u;
//const uint cell_size = 1u << power;
const uint last_level = 4u;

const uint inner_bits = 8u;
const uint max_inner_value = 1u << inner_bits;
//const uint cell_bits = inner_bits + power;
const uint dir_bits = 10u;//32u - 1u - (inner_bits + last_level*power);
const uint max_dir_value = 1u << dir_bits;
//const uint max_cell_value = 1u << cell_bits;
//const uint mask = max_cell_value - 1u;

struct cell_pos {
	uvec2 m;
	uvec2 t;
	float z;
	uint level;
};

uint cell_bits(uint level) { return inner_bits + power * level; }
uint max_cell_value(uint level) { return 1u << cell_bits(level); }
uint mask(uint level) { return max_cell_value(level) - 1u; }

uvec2 outer(cell_pos pos) {
	return pos.m / max_inner_value;
}

uint dist_negative(uint coord, uint level) {
	return (coord & mask(level)) + 1u;
}

uint dist_positive(uint coord, uint level) {
	return max_cell_value(level) - (coord & mask(level));
}

#define CELL_POS_INIT(__name,__x,__y) \
void __name (inout cell_pos pos, uvec2 dir) { \
	pos.t.x = __x (pos.m.x, pos.level); \
	pos.t.y = __y (pos.m.y, pos.level); \
	pos.t <<= dir_bits; \
	pos.t /= dir; \
}

CELL_POS_INIT(cell_pos_init_ru,dist_positive,dist_positive)
CELL_POS_INIT(cell_pos_init_rd,dist_positive,dist_negative)
CELL_POS_INIT(cell_pos_init_lu,dist_negative,dist_positive)
CELL_POS_INIT(cell_pos_init_ld,dist_negative,dist_negative)

float next_cell_dist(cell_pos pos) {
	return float(pos.t.x < pos.t.y ? pos.t.x : pos.t.y) / float(max_inner_value);
}

void add(inout uint a, uint b) { a += b; }
void sub(inout uint a, uint b) { a -= b; }

#define NEXT_CELL(__name,__x_func,__y_func,__x_dist_func,__y_dist_func) \
float __name (inout cell_pos pos, uvec2 dir) { \
	uint cs = max_cell_value(pos.level); \
	uint dist = 0u; \
	if(pos.t.x < pos.t.y) { \
		uint x_d = __x_dist_func (pos.m.x, pos.level); \
		__x_func (pos.m.x, x_d); \
		__y_func (pos.m.y, x_d * dir.y / dir.x); \
		dist = x_d * max_dir_value / dir.x; \
		pos.t.x += cs * max_dir_value / dir.x; \
	} \
	else { \
		uint y_d = __y_dist_func (pos.m.y, pos.level); \
		__y_func (pos.m.y, y_d); \
		__x_func (pos.m.x, y_d * dir.x / dir.y); \
		dist = y_d * max_dir_value / dir.y; \
		pos.t.y += cs * max_dir_value / dir.y; \
	} \
	return float(dist) / float(max_inner_value); \
}

NEXT_CELL(next_cell_ru,add,add, dist_positive, dist_positive)
NEXT_CELL(next_cell_rd,add,sub, dist_positive, dist_negative)
NEXT_CELL(next_cell_lu,sub,add, dist_negative, dist_positive)
NEXT_CELL(next_cell_ld,sub,sub, dist_negative, dist_negative)

/*float next_cell_straight(inout cell_pos pos, vec2 dir, int lod) {
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
}*/

float depth_value(uvec2 m, uint level, sampler2D s) {
	return texelFetch(s, ivec2(m >> cell_bits(level)), int(level)).r;
}

float upper_depth_value(cell_pos pos, sampler2D s) {
	return pos.level < last_level ? depth_value(pos.m, pos.level + 1u, s) : 0.0;
}

float lower_depth_value(cell_pos pos, sampler2D s) {
	return depth_value(pos.m, pos.level, s);
}

#define LOD_INCREASE(__init_func) { \
	++pos.level; \
	__init_func (pos, udir); \
	lower_depth = upper_depth; \
	upper_depth = upper_depth_value(pos, s); \
}

#define LOD_DECREASE(__init_func) { \
	--pos.level; \
	__init_func (pos, udir); \
	upper_depth = lower_depth; \
	lower_depth = lower_depth_value(pos, s); \
}

#define FIND_LOWEST_LOD(__init_func) { \
	while(pos.level > 0u && pos.z >= lower_depth) { \
		LOD_DECREASE(__init_func) \
	} \
}

#define FIND_UPPEST_LOD(__init_func) { \
	while(pos.level < last_level && pos.z < upper_depth) { \
		LOD_INCREASE(__init_func) \
	} \
}

// finds farthest pixel z point in window space
// for camera-space position, normal
/*float farthest_z(
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
}*/

/*void guess(inout fb_traversal_result res, sampler2D sd, sampler2D sn) {
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
}*/

bool is_out_of_fb(cell_pos pos) {
	return
		any(lessThan(outer(pos), uvec2(0u))) ||
		any(greaterThanEqual(outer(pos), uvec2(frxu_size.xy))) ||
		pos.z < 0 || pos.z > 1;
}

#define TRAVERSE_FUNC(__name, __next_func, __init_func) \
fb_traversal_result __name (vec3 dir, vec3 pos_ws, sampler2D s) { \
	cell_pos pos = cell_pos( \
		uvec2(pos_ws.xy) * max_inner_value + (max_inner_value >> 1u), \
		uvec2(0u), \
		pos_ws.z, \
		0u \
	); \
	vec2 dir_xy = normalize(dir.xy);\
	uvec2 udir = uvec2(abs(dir_xy) * float(max_dir_value)); \
	__init_func (pos, udir); \
	float upper_depth = upper_depth_value(pos, s); \
	float lower_depth = lower_depth_value(pos, s); \
	FIND_UPPEST_LOD(__init_func) \
	float dir_xy_length = length(dir.xy); \
	float dir_z_per_xy = dir.z / dir_xy_length; \
	bool backwards = dir.z < 0.0; \
	int steps = 0; \
	while(true) { \
		cell_pos next = pos; \
		float dist = __next_func (next, udir); \
		next.z += dist * dir_z_per_xy; \
		bool under = next.z >= lower_depth; \
		if(under) { \
			if(pos.level == 0u) { \
				return fb_traversal_result(TRAVERSAL_SUCCESS, outer(next), next.z); \
			} \
			float mul = (lower_depth - pos.z) / (next.z - pos.z); \
			dist *= mul; \
			pos.m = uvec2(ivec2(pos.m) + ivec2(float(max_inner_value) * dist * dir_xy)); \
			pos.z = lower_depth; \
			LOD_DECREASE(__init_func) \
		} \
		else { \
			cell_pos prev = pos; \
			pos = next; \
			if(( prev.m >> cell_bits(pos.level + 1u) ) != ( pos.m >> cell_bits(pos.level + 1u) )) { \
				upper_depth = upper_depth_value(pos, s); \
			} \
			FIND_UPPEST_LOD(__init_func) \
			\
			lower_depth = lower_depth_value(pos, s); \
			FIND_LOWEST_LOD(__init_func) \
			if(pos.level == 0u && pos.z >= lower_depth) \
				return fb_traversal_result(TRAVERSAL_UNDER, outer(pos), pos.z); \
		} \
		if(is_out_of_fb(pos)) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, uvec2(0u), 0.0); \
		if(++steps == 50) { \
			out_lag_finder = vec4(1.0, 0.0, 0.0, 0.0); \
			return fb_traversal_result(TRAVERSAL_TOO_LONG, uvec2(0u), 0.0); \
		} \
	} \
}

TRAVERSE_FUNC(traverse_fb_ru, next_cell_ru, cell_pos_init_ru)
TRAVERSE_FUNC(traverse_fb_rd, next_cell_rd, cell_pos_init_rd)
TRAVERSE_FUNC(traverse_fb_lu, next_cell_lu, cell_pos_init_lu)
TRAVERSE_FUNC(traverse_fb_ld, next_cell_ld, cell_pos_init_ld)
//TRAVERSE_FUNC(traverse_fb_straight, next_cell_straight)

fb_traversal_result traverse_fb(vec3 dir, vec3 pos, sampler2D s) {
	if(dir.x == 0.0 && dir.y == 0.0) {
		uvec2 upos = uvec2(pos.xy);
		return fb_traversal_result(TRAVERSAL_SUCCESS, upos, texelFetch(s, ivec2(upos), 0).r);
	}

	if(dir.x == 0.0 || dir.y == 0.0) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, uvec2(0u), 0.0); //traverse_fb_straight(dir, pos, s);

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
		//if(res.code == TRAVERSAL_UNDER)
		//	guess(res, u_sorted_depth, u_sorted_normal);

		if(res.code == TRAVERSAL_SUCCESS || res.code == TRAVERSAL_UNDER) {
			color = texelFetch(u_sorted, ivec2(res.pos), 0);
		}

		float n1 = frx_viewFlag(FRX_CAMERA_IN_FLUID) ? 1.3333 : 1.0;
		float n2 = frx_viewFlag(FRX_CAMERA_IN_FLUID) ? 1.0 : 1.3333;
		vec3 refraction_dir = refract(incidence_cs, normal_cs, n1 / n2);
		dir_ws = cam_dir_to_win(position_cs, refraction_dir, proj);
		//res = traverse_fb(dir_ws, position_ws, u_solid_depth);
		//if(res.code == TRAVERSAL_UNDER)
		//	guess(res, u_solid_depth, u_solid_normal);
		//if(res.code == TRAVERSAL_SUCCESS) {
		//	color0 = texelFetch(u_solid, ivec2(res.pos), 0);
		//}

		/*float cosi = abs(dot(normal_cs, reflection_dir));
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

		ratio = 1.0;//refl_coeff;// / (refl_coeff + refr_coeff);
	}

	out_color = mix(color0, color, ratio);
}