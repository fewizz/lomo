#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl
#include lomo:shaders/lib/sky.glsl
#include lomo:shaders/lib/blend.glsl
#include lomo:shaders/lib/ray_plane.glsl
#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/lib/fixed_point.glsl

/* lomo:post.frag */

uniform sampler2DArray u_colors;
uniform sampler2DArray u_normals;
uniform sampler2DArray u_extras;
uniform sampler2DArray u_depths;
uniform sampler2DArray u_win_normals;
uniform sampler2DArray u_hi_depths;

layout(location = 0) out vec4 out_color;

#define TRAVERSAL_SUCCESS 0
#define TRAVERSAL_OUT_OF_FB 1
#define TRAVERSAL_POSSIBLY_UNDER 2
#define TRAVERSAL_TOO_LONG 3

struct cell_pos {
	uvec2_fp24_8 m;
	uvec2_fp24_8 t;
	float z;
};

struct fb_traversal_result {
	int code;
	cell_pos pos;
};

const uint power = 2u;
const uint levels = 3u;
const uint last_level = levels - 1u;

const uint inner_bits = 8u;
const uint max_inner_value = 1u << inner_bits;
const uint dir_bits = 10u;
const uint max_dir_value = 1u << dir_bits;

uint cell_bits(uint level) { return inner_bits + power * level; }
uint max_cell_value(uint level) { return 1u << cell_bits(level); }
uint mask(uint level) { return max_cell_value(level) - 1u; }

uint dist_negative(fp24_8 coord, uint level) {
	return (coord.value & mask(level)) + 1u;
}

uint dist_positive(fp24_8 coord, uint level) {
	return max_cell_value(level) - (coord.value & mask(level));
}

#define CELL_POS_INIT(__name, __x, __y) \
void __name (inout cell_pos pos, uint level, uvec2_fp22_10 dir) { \
	pos.t.x.value = __x (pos.m.x, level); \
	pos.t.y.value = __y (pos.m.y, level); \
	pos.t = div(pos.t, dir); \
}

CELL_POS_INIT(cell_pos_init_ru, dist_positive, dist_positive)
CELL_POS_INIT(cell_pos_init_rd, dist_positive, dist_negative)
CELL_POS_INIT(cell_pos_init_lu, dist_negative, dist_positive)
CELL_POS_INIT(cell_pos_init_ld, dist_negative, dist_negative)

#define CELL_POS_INIT_STRAIGHT(__name, __element, __dist_func) \
void __name (inout cell_pos pos, uint level, uvec2_fp22_10 dir) { \
	pos.t.x.value = 0u - 1u; \
	pos.t.y.value = 0u - 1u; \
	pos.t. __element .value = __dist_func (pos.m. __element , level); \
}

CELL_POS_INIT_STRAIGHT(cell_pos_init_u, y, dist_positive)
CELL_POS_INIT_STRAIGHT(cell_pos_init_r, x, dist_positive)
CELL_POS_INIT_STRAIGHT(cell_pos_init_d, y, dist_negative)
CELL_POS_INIT_STRAIGHT(cell_pos_init_l, x, dist_negative)

float next_cell_dist(cell_pos pos) {
	return float(pos.t.x.value < pos.t.y.value ? pos.t.x.value : pos.t.y.value) / float(max_inner_value);
}

#define NEXT_CELL(__name,__x_op,__y_op,__x_dist_func,__y_dist_func) \
float __name (inout cell_pos pos, uint level, uvec2_fp22_10 dir) { \
	uint cs = max_cell_value(level); \
	uint dist = 0u; \
	if(pos.t.x.value < pos.t.y.value) { \
		uint x_d = __x_dist_func (pos.m.x, level); \
		pos.m.x.value __x_op x_d; \
		pos.m.y.value __y_op x_d * dir.y.value / dir.x.value; \
		dist = x_d * max_dir_value / dir.x.value; \
		pos.t.x.value += cs * max_dir_value / dir.x.value; \
	} \
	else { \
		uint y_d = __y_dist_func (pos.m.y, level); \
		pos.m.y.value __y_op y_d; \
		pos.m.x.value __x_op y_d * dir.x.value / dir.y.value; \
		dist = y_d * max_dir_value / dir.y.value; \
		pos.t.y.value += cs * max_dir_value / dir.y.value; \
	} \
	return float(dist) / float(max_inner_value); \
}

NEXT_CELL(next_cell_ru,+=,+=, dist_positive, dist_positive)
NEXT_CELL(next_cell_rd,+=,-=, dist_positive, dist_negative)
NEXT_CELL(next_cell_lu,-=,+=, dist_negative, dist_positive)
NEXT_CELL(next_cell_ld,-=,-=, dist_negative, dist_negative)

#define NEXT_CELL_STRAIGHT(__name, __element, __op, __dist_func) \
float __name (inout cell_pos pos, uint level, uvec2_fp22_10 dir) { \
	uint dist = __dist_func(pos.m. __element , level); \
	pos.m. __element .value __op dist; \
	return float(dist) / float(max_inner_value); \
}

NEXT_CELL_STRAIGHT(next_cell_u, y,+=, dist_positive)
NEXT_CELL_STRAIGHT(next_cell_r, x,+=, dist_positive)
NEXT_CELL_STRAIGHT(next_cell_d, y,-=, dist_negative)
NEXT_CELL_STRAIGHT(next_cell_l, x,-=, dist_negative)

#define DEPTH_VALUE(__pos, __level) \
	( texelFetch(u_hi_depths, ivec3(outer_as_uvec2(__pos.m) >> (power * __level), uint(f)), int(__level)).r )

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
		any(greaterThanEqual(outer_as_uvec2(pos.m), uvec2(frxu_size))) ||
		pos.z <= 0 || pos.z >= 1;
}

#define SURFACE_NOT_INTERSECT 0
#define SURFACE_INTERSECT 1
#define SURFACE_UNDER 2

int check_if_intersected(inout cell_pos pos, vec3 dir, uint f) {
	uvec2 o = outer_as_uvec2(pos.m);
	float real_depth = texelFetch(u_depths, ivec3(o, int(f)), 0).r;
	vec3 normal_ws = normalize(texelFetch(u_win_normals, ivec3(o, int(f)), 0).rgb);

	plane p = plane_from_pos_and_normal(vec3(vec2(0.5), real_depth), normal_ws);

	vec3 ray_pos = vec3(inner_as_vec2(pos.m), pos.z);

	float depth_at_pos = ray_plane_intersection(ray(ray_pos, vec3(0, 0, 1)), p).dist;

	if(depth_at_pos < 0.) return SURFACE_UNDER;

	ray r = ray(ray_pos, dir);
	ray_plane_intersection_result res = ray_plane_intersection(r, p);

	vec3 intersection_pos = ray_pos + dir * res.dist;

	if(
		(dot(normal_ws, dir) > 0 && res.dist == 0) ||
		res.dist < 0. || any(lessThan(intersection_pos.xy, vec2(0.0))) || any(greaterThan(intersection_pos.xy, vec2(1.0)))) {
		return SURFACE_NOT_INTERSECT;
	}

	pos.z = intersection_pos.z;
	pos.m = add(clean_inner(pos.m), uvec2_fp24_8_from_vec2(intersection_pos.xy));

	return SURFACE_INTERSECT;
}

#define TRAVERSE_FUNC(__name, __next_func, __init_func) \
fb_traversal_result __name (vec3 dir, vec3 pos_ws, uint f) { \
	cell_pos pos = cell_pos( \
		uvec2_fp24_8_from_vec2(pos_ws.xy), \
		zero_uvec2_fp24_8(), \
		pos_ws.z \
	); \
	vec2 dir_xy = normalize(dir.xy); \
	uvec2_fp22_10 udir = uvec2_fp22_10_from_vec2(abs(dir_xy)); \
	__init_func (pos, 0u, udir); \
	uint level = 0u; \
	float upper_depth = UPPER_DEPTH_VALUE(pos); \
	float lower_depth = LOWER_DEPTH_VALUE(pos); \
	FIND_UPPEST_LOD(__init_func, pos); \
	float dir_z_per_xy = dir.z / length(dir.xy); \
	\
	for(int i = 0; i < 100; ++i) { \
		if(is_out_of_fb(pos)) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, cell_pos(zero_uvec2_fp24_8(), zero_uvec2_fp24_8(), 0.0)); \
		\
		cell_pos prev = pos; \
		float dist = __next_func (pos, level, udir); \
		pos.z += dist * dir_z_per_xy; \
		\
		if(pos.z >= lower_depth) { \
			if(level >= 0u && prev.z < lower_depth) { \
				float mul = (lower_depth - prev.z) / (pos.z - prev.z); \
				dist *= mul; \
				pos.m = add(prev.m, dist * dir_xy); \
				pos.z = lower_depth; \
				__init_func(pos, level, udir); \
				FIND_LOWEST_LOD(__init_func, pos); \
				continue; \
			} \
			if(level == 0u) { \
				int result = check_if_intersected(prev, dir, f); \
				if(result == SURFACE_INTERSECT) \
					return fb_traversal_result(TRAVERSAL_SUCCESS, prev); \
				else if(result == SURFACE_UNDER) \
					return fb_traversal_result(TRAVERSAL_POSSIBLY_UNDER, cell_pos(uvec2_fp24_8_from_vec2(vec2(i)), zero_uvec2_fp24_8(), prev.z)); \
			} \
		} \
		\
		/* switching the cell */ \
		__init_func(pos, level, udir); \
		UPDATE_UPPER_DEPTH(pos); \
		FIND_UPPEST_LOD(__init_func, pos); \
		UPDATE_LOWER_DEPTH(pos); \
		FIND_LOWEST_LOD(__init_func, pos); \
	} \
	return fb_traversal_result(TRAVERSAL_TOO_LONG, cell_pos(zero_uvec2_fp24_8(), zero_uvec2_fp24_8(), 0.0)); \
}

TRAVERSE_FUNC(traverse_fb_ru, next_cell_ru, cell_pos_init_ru)
TRAVERSE_FUNC(traverse_fb_rd, next_cell_rd, cell_pos_init_rd)
TRAVERSE_FUNC(traverse_fb_lu, next_cell_lu, cell_pos_init_lu)
TRAVERSE_FUNC(traverse_fb_ld, next_cell_ld, cell_pos_init_ld)

TRAVERSE_FUNC(traverse_fb_u, next_cell_u, cell_pos_init_u)
TRAVERSE_FUNC(traverse_fb_r, next_cell_r, cell_pos_init_r)
TRAVERSE_FUNC(traverse_fb_d, next_cell_d, cell_pos_init_d)
TRAVERSE_FUNC(traverse_fb_l, next_cell_l, cell_pos_init_l)

fb_traversal_result traverse_fb(vec3 dir, vec3 pos, uint f) {
	if(dir.x == 0.0 && dir.y == 0.0) {
		uvec2 upos = uvec2(pos.xy);
		float d = texelFetch(u_depths, ivec3(upos, f), 0).r;

		if(dir.z > 0 && d >= pos.z)
			return fb_traversal_result(TRAVERSAL_SUCCESS, cell_pos(uvec2_fp24_8_from_vec2(pos.xy), zero_uvec2_fp24_8(), d));

		return fb_traversal_result(TRAVERSAL_OUT_OF_FB, cell_pos(zero_uvec2_fp24_8(), zero_uvec2_fp24_8(), 0.0));
	}

	if(dir.x == 1.0)
		return traverse_fb_r(dir, pos, f);
	if(dir.x == -1.0)
		return traverse_fb_l(dir, pos, f);

	if(dir.y == 1.0)
		return traverse_fb_u(dir, pos, f);
	if(dir.y == -1.0)
		return traverse_fb_d(dir, pos, f);

	if(dir.x > 0.0) {
		if(dir.y > 0.0)
			return traverse_fb_ru(dir, pos, f);
		else
			return traverse_fb_rd(dir, pos, f);
	}
	else {
		if(dir.y > 0.0)
			return traverse_fb_lu(dir, pos, f);
		else
			return traverse_fb_ld(dir, pos, f);
	}
}

void main() {
	const int steps = 3;
	const int max_index = steps - 1;
	vec3 lights[steps];
	vec3 colors[steps];

	float depth_ws = texelFetch(u_depths, ivec3(gl_FragCoord.xy, 0), 0).r;
	vec3 pos_ws = vec3(gl_FragCoord.xy, depth_ws);
	vec3 color = texelFetch(u_colors, ivec3(pos_ws.xy, 0), 0).rgb;

	int i = 0;

	vec3 incidence_cs = normalize(win_to_cam(pos_ws) - win_to_cam(vec3(gl_FragCoord.xy, 0)));

	while(true) {
		if(pos_ws.z >= 1.) {
			vec3 light = sky_color(mat3(frx_inverseViewMatrix) * incidence_cs);
			lights[i] = light;
			break;
		}

		vec4 extras = texelFetch(u_extras, ivec3(pos_ws.xy, 0), 0);
		float reflectivity = extras.x;
		float sky_light = extras.y;
		float block_light = extras.z;
	
		lights[i] = color*block_light*block_light;
		colors[i] = color*(1.0 - block_light*block_light);

		if(i >= max_index) break;

		vec3 normal_cs = texelFetch(u_normals, ivec3(pos_ws.xy, 0), 0).xyz;
		if(length(normal_cs) < 0.5) {
			break;
		}

		++i;

		vec2 rand = hash22(pos_ws.xy) * 2. - 1.;

		rand.x *= (1. - reflectivity);
		rand *= 3.1416 / 2.0;

		vec3 new_normal_cs = rotation(rand.x, normalize(cross(incidence_cs, normal_cs))) * normal_cs;
		normal_cs = rotation(rand.y, normal_cs) * new_normal_cs;

		vec3 reflection_dir = normalize(
			reflect(
				incidence_cs,
				normal_cs
			)
		);

		vec3 pos_cs = win_to_cam(pos_ws);
		vec3 dir_ws = cam_dir_to_win(pos_cs, reflection_dir);

		fb_traversal_result res = traverse_fb(dir_ws, pos_ws, 0u);

		if(res.pos.z < 1. && res.code == TRAVERSAL_SUCCESS) {
			lights[i] = vec3(1.0, 0.0, 1.0);
			break;
			//color = pow3(texelFetch(u_colors, ivec3(outer_as_uvec2(res.pos.m), 0), 0).rgb, 2.2);
			//pos_ws.xy = fp_as_vec2(res.pos.m);
			//pos_ws.z = res.pos.z;
		}
		else if(res.code == TRAVERSAL_POSSIBLY_UNDER) {
			lights[i] = vec3(1.0, 0.0, 0.0);
			break;
		}
		else if(res.code == TRAVERSAL_OUT_OF_FB) {
			lights[i] = vec3(0.0, 1.0, 0.0);
			break;
		}
		else if(res.code == TRAVERSAL_TOO_LONG) {
			lights[i] = vec3(0.0, 0.0, 1.0);
			break;
		}
		else {
			vec3 light = sky_color(mat3(frx_inverseViewMatrix) * reflection_dir);
			lights[i] = light * sky_light * sky_light;
			break;
		}

		incidence_cs = reflection_dir;
	}

	color = lights[i];

	//while(--i >= 0) {
	//	color = color * colors[i] + lights[i];
	//}

	out_color = vec4(pow3(color, 1.0 / 2.2), 1.0);
}