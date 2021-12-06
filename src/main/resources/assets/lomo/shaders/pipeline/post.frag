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

layout(location = 0) out vec4 out_color;

#define TRAVERSAL_SUCCESS 0
#define TRAVERSAL_OUT_OF_FB 1
//#define TRAVERSAL_POSSIBLY_UNDER 2

struct fb_traversal_result {
	int code;
	uvec2 pos;
	float z;
	float prev_z;
};

const uint power = 2u;
const uint levels = 5u;
const uint last_level = levels - 1u;

const uint inner_bits = 8u;
const uint max_inner_value = 1u << inner_bits;
const uint dir_bits = 10u;
const uint max_dir_value = 1u << dir_bits;

struct cell_pos {
	uvec2 m;
	uvec2 t;
	float z;
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
void __name (inout cell_pos pos, uint level, uvec2 dir) { \
	pos.t.x = __x (pos.m.x, level); \
	pos.t.y = __y (pos.m.y, level); \
	pos.t <<= dir_bits; \
	pos.t /= dir; \
}

CELL_POS_INIT(cell_pos_init_ru, dist_positive, dist_positive)
CELL_POS_INIT(cell_pos_init_rd, dist_positive, dist_negative)
CELL_POS_INIT(cell_pos_init_lu, dist_negative, dist_positive)
CELL_POS_INIT(cell_pos_init_ld, dist_negative, dist_negative)

#define CELL_POS_INIT_STRAIGHT(__name, __element, __dist_func) \
void __name (inout cell_pos pos, uint level, uvec2 dir) { \
	pos.t = uvec2(0u - 1u); \
	pos.t. __element = __dist_func (pos.m. __element , level); \
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
float __name (inout cell_pos pos, uint level, uvec2 dir) { \
	uint cs = max_cell_value(level); \
	uint dist = 0u; \
	if(pos.t.x < pos.t.y) { \
		uint x_d = __x_dist_func (pos.m.x, level); \
		__x_func (pos.m.x, x_d); \
		__y_func (pos.m.y, x_d * dir.y / dir.x); \
		dist = x_d * max_dir_value / dir.x; \
		pos.t.x += cs * max_dir_value / dir.x; \
	} \
	else { \
		uint y_d = __y_dist_func (pos.m.y, level); \
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
float __name (inout cell_pos pos, uint level, uvec2 dir) { \
	uint dist = __dist_func(pos.m. __element , level); \
	__func(pos.m. __element , dist); \
	return float(dist) / float(max_inner_value); \
}

NEXT_CELL_STRAIGHT(next_cell_u, y, add, dist_positive)
NEXT_CELL_STRAIGHT(next_cell_r, x, add, dist_positive)
NEXT_CELL_STRAIGHT(next_cell_d, y, sub, dist_negative)
NEXT_CELL_STRAIGHT(next_cell_l, x, sub, dist_negative)

#define DEPTH_VALUE(__pos, __level) \
	( texelFetch(s, ivec3(__pos.m >> cell_bits(__level), uint(f)), int(__level)).r )

#define UPPER_DEPTH_VALUE(__pos) \
	( level < last_level ? DEPTH_VALUE(__pos, level+1u) : 0.0 )

#define LOWER_DEPTH_VALUE(__pos) \
	( DEPTH_VALUE(__pos, level) )

#define UPDATE_UPPER_DEPTH(__pos) { \
	upper_depth = UPPER_DEPTH_VALUE(__pos); \
}

#define UPDATE_LOWER_DEPTH(__pos) { \
	lower_depth = LOWER_DEPTH_VALUE(__pos); \
}

#define LOD_INCREASE(__init_func, __pos) { \
	++level; \
	__init_func (__pos, level, udir); \
	lower_depth = upper_depth; \
	upper_depth = UPPER_DEPTH_VALUE(__pos); \
}

#define LOD_DECREASE(__init_func, __pos) { \
	--level; \
	__init_func (__pos, level, udir); \
	upper_depth = lower_depth; \
	lower_depth = LOWER_DEPTH_VALUE(__pos); \
}

#define FIND_LOWEST_LOD(__init_func, __pos) { \
	while(level > 0u && __pos.z >= lower_depth) { \
		LOD_DECREASE(__init_func, __pos); \
	} \
}

#define FIND_UPPEST_LOD(__init_func, __pos) { \
	while(level < last_level && __pos.z < upper_depth) { \
		LOD_INCREASE(__init_func, __pos); \
	} \
}

bool is_out_of_fb(cell_pos pos) {
	return
		any(greaterThanEqual(outer(pos), uvec2(frxu_size))) ||
		pos.z <= 0;
}

// AFTER  2

#define TRAVERSE_FUNC(__name, __next_func, __init_func) \
fb_traversal_result __name (vec3 dir, vec3 pos_ws, sampler2DArray s, uint f) { \
	cell_pos pos = cell_pos( \
		uvec2(pos_ws.xy) * max_inner_value + (max_inner_value >> 1u), \
		uvec2(0u), \
		pos_ws.z \
	); \
	uint level = 0u; \
	vec2 dir_xy = normalize(dir.xy); \
	uvec2 udir = uvec2(abs(dir_xy) * float(max_dir_value)); \
	__init_func (pos, level, udir); \
	float upper_depth = UPPER_DEPTH_VALUE(pos); \
	float lower_depth = LOWER_DEPTH_VALUE(pos); \
	FIND_UPPEST_LOD(__init_func, pos); \
	float dir_z_per_xy = dir.z / length(dir.xy); \
	\
	while(true) { \
		cell_pos prev = pos; \
		float dist = __next_func (pos, level, udir); \
		pos.z += dist * dir_z_per_xy; \
		\
		if(level > 0u && pos.z >= lower_depth) { \
			float mul = (lower_depth - prev.z) / (pos.z - prev.z); \
			dist *= mul; \
			pos.m = uvec2(ivec2(prev.m) + ivec2(float(max_inner_value) * dist * dir_xy)); \
			pos.z = lower_depth; \
		} \
		else { \
			if((pos.m >> cell_bits(level + 1u) ) != ( prev.m >> cell_bits(level + 1u) )) { \
				UPDATE_UPPER_DEPTH(pos); \
			} \
			FIND_UPPEST_LOD(__init_func, pos); \
			UPDATE_LOWER_DEPTH(pos); \
		} \
		\
		if(is_out_of_fb(pos)) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, uvec2(0u), 0.0, 0.0); \
		\
		FIND_LOWEST_LOD(__init_func, pos); \
		if(level == 0u && pos.z >= lower_depth) { \
			return fb_traversal_result(TRAVERSAL_SUCCESS, outer(pos), pos.z, prev.z); \
		} \
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
	float depth_ws = texelFetch(u_depths, ivec3(gl_FragCoord.xy, 0), 0).r;

	vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
	vec3 position_cs = win_to_cam(position_ws);

	vec3 incidence_cs = normalize(position_cs - win_to_cam(vec3(gl_FragCoord.xy, 0)));
	vec4 extras = texelFetch(u_extras, ivec3(position_ws.xy, 0), 0);
	float reflectivity0 = extras.x;
	float block_light0 = extras.z;

	if(depth_ws >= 1) {
		out_color = vec4(sky_color(mat3(frx_inverseViewMatrix) * incidence_cs, 0.0), 1.0);
		return;
	}

	vec4 colors0[6] = vec4[](vec4(0.), vec4(0.), vec4(0.), vec4(0.), vec4(0.), vec4(0.));
	uint layer = 0u;

	while(layer < 6u) {
		vec4 c = texelFetch(u_colors, ivec3(gl_FragCoord.xy, layer), 0);
		colors0[layer++] = c;

		if(c.a == 1.0) {
			break;
		}
	}

	vec3 base_color = colors0[--layer].rgb;

	while(layer > 0u) {
		base_color = blend(base_color, colors0[--layer]);
	}

	const int steps = 3;

	vec3 lights[steps];
	vec3 colors[steps];
	float reflectivities[steps];

	float reflectivity = extras.x;
	float sky_light = extras.y;
	float block_light = extras.z;
	
	colors[0] = base_color*(1.0 - block_light);
	lights[0] = base_color*block_light;
	reflectivities[0] = reflectivity;

	int i = 1;
	for(; i < steps; ++i) {
		vec3 raw_normal = texelFetch(u_normals, ivec3(position_ws.xy, 0), 0).xyz;
		vec3 normal_cs = normalize(raw_normal * 2.0 - 1.0);
	
		vec3 reflection_dir = normalize(
			reflect(
				incidence_cs,
				normal_cs
			)
		);

		vec2 rand = hash22(position_ws.xy) * 2. - 1.;

		rand *= 1. - reflectivity;
		rand *= 3.1416 / 2.0;

		reflection_dir = rotation(rand.x, normal_cs) * reflection_dir;
		reflection_dir = rotation(rand.y, normalize(cross(reflection_dir, normal_cs))) * reflection_dir;

		vec3 dir_ws = cam_dir_to_win(position_cs, reflection_dir);

		// applying z offset, dumb'ish
		float z_per_xy = dir_ws.z / length(dir_ws.xy);
		position_ws.z -= abs(z_per_xy)*2.0;

		fb_traversal_result res = traverse_fb(dir_ws, position_ws, u_depths, layer);

		if(res.z < 1.0 && res.code == TRAVERSAL_SUCCESS) {
			vec3 new_color = texelFetch(u_colors, ivec3(res.pos, int(layer)), 0).rgb;
			extras = texelFetch(u_extras, ivec3(position_ws.xy, 0), 0);
			lights[i] = new_color * extras.z;
			colors[i] = new_color * (1.0 - extras.z);
			reflectivity = extras.x;
			reflectivities[i] = reflectivity;

			position_ws.xy = vec2(res.pos) + vec2(0.5);
			position_ws.z = res.z;
		}
		else {
			vec3 light = sky_color(mat3(frx_inverseViewMatrix) * reflection_dir, 0.0);
			lights[i] = light * extras.y;
			++i;
			break;
		}

		//reflectivities[i] = reflectivity;
		incidence_cs = reflection_dir;
	}

	vec3 color = lights[--i];

	while(--i >= 0) {
		color = color * colors[i] + lights[i];
	}

	out_color = vec4(color, 1.0);
}