#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl
#include lomo:shaders/lib/sky.glsl
#include lomo:shaders/lib/blend.glsl

/* lomo:post.frag */

uniform sampler2DArray u_colors;
uniform sampler2DArray u_normals;
uniform sampler2DArray u_extras;
uniform sampler2DArray u_depths;

//layout(location = 0) out vec4 out_color;
//layout(location = 1) out vec4 out_color;
layout(location = 0) out vec4 out_noise;
layout(location = 1) out vec4 out_noise_extra;
layout(location = 2) out vec4 out_color;
//layout(location = 1) out vec4 out_noise_normal;
//out vec4 out_lag_finder;

#define TRAVERSAL_SUCCESS 0
//#define TRAVERSAL_POSSIBLY_UNDER 1
#define TRAVERSAL_OUT_OF_FB 2
#define TRAVERSAL_TOO_LONG 3

struct fb_traversal_result {
	int code;
	uvec2 pos;
	float z;
	float prev_z;
};

const uint power = 2u;
const uint last_level = 4u;

const uint inner_bits = 8u;
const uint max_inner_value = 1u << inner_bits;
const uint dir_bits = 10u;
const uint max_dir_value = 1u << dir_bits;

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

#define CELL_POS_INIT(__name, __x, __y) \
void __name (inout cell_pos pos, uvec2 dir) { \
	pos.t.x = __x (pos.m.x, pos.level); \
	pos.t.y = __y (pos.m.y, pos.level); \
	pos.t <<= dir_bits; \
	pos.t /= dir; \
}

CELL_POS_INIT(cell_pos_init_ru, dist_positive, dist_positive)
CELL_POS_INIT(cell_pos_init_rd, dist_positive, dist_negative)
CELL_POS_INIT(cell_pos_init_lu, dist_negative, dist_positive)
CELL_POS_INIT(cell_pos_init_ld, dist_negative, dist_negative)

#define CELL_POS_INIT_STRAIGHT(__name, __element, __dist_func) \
void __name (inout cell_pos pos, uvec2 dir) { \
	pos.t = uvec2(0u - 1u); \
	pos.t. __element = __dist_func (pos.m. __element , pos.level); \
}

CELL_POS_INIT_STRAIGHT(cell_pos_init_u, y, dist_positive)
CELL_POS_INIT_STRAIGHT(cell_pos_init_r, x, dist_positive)
CELL_POS_INIT_STRAIGHT(cell_pos_init_d, y, dist_negative)
CELL_POS_INIT_STRAIGHT(cell_pos_init_l, x, dist_negative)

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

#define NEXT_CELL_STRAIGHT(__name, __element, __func, __dist_func) \
float __name (inout cell_pos pos, uvec2 dir) { \
	uint dist = __dist_func(pos.m. __element , pos.level); \
	__func(pos.m. __element , dist); \
	return float(dist) / float(max_inner_value); \
}

NEXT_CELL_STRAIGHT(next_cell_u, y, add, dist_positive)
NEXT_CELL_STRAIGHT(next_cell_r, x, add, dist_positive)
NEXT_CELL_STRAIGHT(next_cell_d, y, sub, dist_negative)
NEXT_CELL_STRAIGHT(next_cell_l, x, sub, dist_negative)

float depth_value(uvec2 m, uint level, sampler2DArray s, uint f) {
	return texelFetch(s, ivec3(m >> cell_bits(level), uint(f)), int(level)).r;
}

float upper_depth_value(cell_pos pos, sampler2DArray s, uint f) {
	return pos.level < last_level ? depth_value(pos.m, pos.level + 1u, s, f) : 0.0;
}

float lower_depth_value(cell_pos pos, sampler2DArray s, uint f) {
	return depth_value(pos.m, pos.level, s, f);
}

#define LOD_INCREASE(__init_func, __pos) { \
	++__pos.level; \
	__init_func (__pos, udir); \
	lower_depth = upper_depth; \
	upper_depth = upper_depth_value(__pos, s, f); \
}

#define LOD_DECREASE(__init_func, __pos) { \
	--__pos.level; \
	__init_func (__pos, udir); \
	upper_depth = lower_depth; \
	lower_depth = lower_depth_value(__pos, s, f); \
}

#define FIND_LOWEST_LOD(__init_func, __pos) { \
	while(__pos.level > 0u && __pos.z >= lower_depth) { \
		LOD_DECREASE(__init_func, __pos) \
	} \
}

#define FIND_UPPEST_LOD(__init_func, __pos) { \
	while(__pos.level < last_level && __pos.z < upper_depth) { \
		LOD_INCREASE(__init_func, __pos) \
	} \
}

bool is_out_of_fb(cell_pos pos) {
	return
		any(greaterThanEqual(outer(pos), uvec2(frxu_size))) ||
		pos.z <= 0;
}

#define TRAVERSE_FUNC(__name, __next_func, __init_func) \
fb_traversal_result __name (vec3 dir, vec3 pos_ws, sampler2DArray s, uint f) { \
	cell_pos pos = cell_pos( \
		uvec2(pos_ws.xy) * max_inner_value + (max_inner_value >> 1u), \
		uvec2(0u), \
		pos_ws.z, \
		0u \
	); \
	vec2 dir_xy = normalize(dir.xy);\
	uvec2 udir = uvec2(abs(dir_xy) * float(max_dir_value)); \
	__init_func (pos, udir); \
	float upper_depth = upper_depth_value(pos, s, f); \
	float lower_depth = lower_depth_value(pos, s, f); \
	FIND_UPPEST_LOD(__init_func, pos) \
	float dir_z_per_xy = dir.z / length(dir.xy); \
	\
	while(true) { \
		cell_pos next = pos; \
		float dist = __next_func (next, udir); \
		next.z += dist * dir_z_per_xy; \
		\
		if(pos.level > 0u && next.z >= lower_depth) { \
			float mul = (lower_depth - pos.z) / (next.z - pos.z); \
			dist *= mul; \
			next.m = uvec2(ivec2(pos.m) + ivec2(float(max_inner_value) * dist * dir_xy)); \
			next.z = lower_depth; \
		} \
		else { \
			if(( pos.m >> cell_bits(pos.level + 1u) ) != ( next.m >> cell_bits(next.level + 1u) )) { \
				upper_depth = upper_depth_value(next, s, f); \
			} \
			FIND_UPPEST_LOD(__init_func, next) \
			lower_depth = lower_depth_value(next, s, f); \
		} \
		\
		FIND_LOWEST_LOD(__init_func, next) \
		if(is_out_of_fb(next)) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, uvec2(0u), 0.0, 0.0); \
		\
		if(next.level == 0u && pos.z >= lower_depth) { \
			return fb_traversal_result(TRAVERSAL_SUCCESS, outer(next), next.z, pos.z); \
		} \
		\
		pos = next; \
	} \
}

TRAVERSE_FUNC(traverse_fb_ru, next_cell_ru, cell_pos_init_ru)
TRAVERSE_FUNC(traverse_fb_rd, next_cell_rd, cell_pos_init_rd)
TRAVERSE_FUNC(traverse_fb_lu, next_cell_lu, cell_pos_init_lu)
TRAVERSE_FUNC(traverse_fb_ld, next_cell_ld, cell_pos_init_ld)

TRAVERSE_FUNC(traverse_fb_u, next_cell_u, cell_pos_init_u)
TRAVERSE_FUNC(traverse_fb_r, next_cell_r, cell_pos_init_r)
TRAVERSE_FUNC(traverse_fb_d, next_cell_d, cell_pos_init_d)
TRAVERSE_FUNC(traverse_fb_l, next_cell_l, cell_pos_init_l)

fb_traversal_result traverse_fb(vec3 dir, vec3 pos, sampler2DArray s, uint f) {
	if(dir.x == 0.0 && dir.y == 0.0) {
		uvec2 upos = uvec2(pos.xy);
		float d = texelFetch(s, ivec3(upos, f), 0).r;

		if(dir.z > 0 && d >= pos.z)
			return fb_traversal_result(TRAVERSAL_SUCCESS, upos, d, pos.z);

		return fb_traversal_result(TRAVERSAL_OUT_OF_FB, upos, 0, 0);
	}

	if(dir.x == 1.0)
		return traverse_fb_r(dir, pos, s, f);
	if(dir.x == -1.0)
		return traverse_fb_l(dir, pos, s, f);

	if(dir.y == 1.0)
		return traverse_fb_u(dir, pos, s, f);
	if(dir.y == -1.0)
		return traverse_fb_d(dir, pos, s, f);

	if(dir.x > 0.0) {
		if(dir.y > 0.0) return traverse_fb_ru(dir, pos, s, f);
		else return traverse_fb_rd(dir, pos, s, f);
	}
	else {
		if(dir.y > 0.0) return traverse_fb_lu(dir, pos, s, f);
		else return traverse_fb_ld(dir, pos, s, f);
	}
}

void traverse_fb_with_check(vec3 dir, vec3 pos, sampler2DArray s, uint f) {

}

void main() {
	vec4 colors[6] = vec4[](vec4(0.), vec4(0.), vec4(0.), vec4(0.), vec4(0.), vec4(0.));
	uint layer = 0u;

	uint nontranslucent_index = 0u;

	while(layer < 6u) {
		vec4 c = texelFetch(u_colors, ivec3(gl_FragCoord.xy, layer), 0);
		colors[layer++] = c;

		if(c.a == 1.0) {
			nontranslucent_index = layer - 1u;
			break;
		}
	}

	vec3 base_color = colors[--layer].rgb;

	while(layer > 0u) {
		base_color = blend(base_color, colors[--layer]);
	}

	out_color = vec4(base_color, 1.0);

	float depth_ws = texelFetch(u_depths, ivec3(gl_FragCoord.xy, 0), 0).r;
	float nontranslucent_depth_ws = texelFetch(u_depths, ivec3(gl_FragCoord.xy, int(nontranslucent_index)), 0).r;
	vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
	vec3 position_cs = win_to_cam(position_ws);
	
	vec4 extras = texelFetch(u_extras, ivec3(gl_FragCoord.xy, 0), 0);
	float reflectivity = extras.x;
	float sky = extras.y;

	vec3 incidence_cs = normalize(position_cs - win_to_cam(vec3(gl_FragCoord.xy, 0)));
	vec3 normal_cs = vec3(0.0);
	vec3 reflection_dir = vec3(0.0);
	
	if(nontranslucent_depth_ws != 1.0) {
		vec3 raw_normal = texelFetch(u_normals, ivec3(gl_FragCoord.xy, 0), 0).xyz;
		normal_cs = normalize(raw_normal * 2.0 - 1.0);
	
		reflection_dir = normalize(
			reflect(
				incidence_cs,
				normal_cs
			)
		);
	}
	else {
		out_noise = vec4(
			sky_color(mat3(frx_inverseViewMatrix) * incidence_cs, 0.0),
			1.0
		);
		out_noise_extra = vec4(
			1.0,
			0.0,
			vec2(0.0)
		);
		return;
	}

	//vec4 worldPos = frx_inverseViewMatrix * vec4(position_cs, 1.0);
	//worldPos /= worldPos.w;
	//worldPos.xyz += frx_cameraPos;

	uvec2 rand = uvec2(position_ws.xy * 1000) * 10000000u;

	reflection_dir = random_vec(
		reflection_dir,
		reflectivity,
		rand
	);

	if(hash12(hash22(rand)) > reflectivity*reflectivity || dot(reflection_dir, normal_cs) <= 0) {
		float block = extras.z;

		if(hash12(hash22(rand)) < block*block) {
			out_noise = vec4(
				base_color,
				1.0
			);
			out_noise_extra = vec4(
				reflectivity,
				0.0,
				vec2(0.0)
			);
		}
		else {
			out_noise = vec4(0.);
			out_noise_extra = vec4(
				reflectivity,
				1.0,
				vec2(0.0)
			);
		}
		return;
	}

	vec3 dir_ws = cam_dir_to_win(position_cs, reflection_dir);

	// applying z offset, dumb'ish
	float z_per_xy = dir_ws.z / length(dir_ws.xy);
	position_ws.z -= abs(z_per_xy)*2.0;

	//while(layer < 6u) {
	vec3 color = vec3(0.);
	//vec3 pos = vec3(0.);

		//if(dot(reflection_dir, normal_cs) > 0) {
	fb_traversal_result res = traverse_fb(dir_ws, position_ws, u_depths, layer);

	if(res.z < 1.0 && res.code == TRAVERSAL_SUCCESS) {
		color = texelFetch(u_colors, ivec3(res.pos, int(layer)), 0).rgb;

			//if(res.z < 1) {
			//	vec2 dist_to_border = vec2(1.0) - abs(vec2(res.pos) / vec2(frxu_size) * 2.0 - 1.0);
			//	float min_dist_to_border = min(dist_to_border.x, dist_to_border.y);
				//ratio *= pow(min_dist_to_border, 0.3);
			//}
	}
	else {
		if(sky > 0.0) color = sky_color(mat3(frx_inverseViewMatrix) * reflection_dir, 0.0) * sky;
		color *= sky;
	}

	//pos = vec3(vec2(res.pos), res.z);

	//colors[layer++] = color;

	//if(color.a == 1.0) {
	//	break;
	//}

	//position_ws = pos;
	//}

	//base_color = colors[--layer].rgb;

	//while(layer > 0u) {
	//	base_color = blend(base_color, colors[--layer]);
	//}

	//vec3 original_color = texelFetch(u_colors, ivec3(gl_FragCoord.xy, 0), 0).rgb;
	//out_color = vec4(mix(original_color, base_color, reflectivity), 1.);
	out_noise = vec4(
		color,
		1.0
	);
	out_noise_extra = vec4(
		reflectivity,
		0.0,
		vec2(0.)
	);
	//out_noise_normal = vec4(reflection_dir, 1.0);
}