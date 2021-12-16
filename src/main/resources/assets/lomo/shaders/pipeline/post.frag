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
const uint levels = 5u;
const uint last_level = levels - 1u;

uint cell_bits(uint level) { return 8u + power * level; }
uint max_cell_value(uint level) { return 1u << cell_bits(level); }
uint mask(uint level) { return max_cell_value(level) - 1u; }

fp24_8 dist_negative(fp24_8 coord, uint level) {
	return fp24_8((coord.value & mask(level)) + 1u);
}

fp24_8 dist_positive(fp24_8 coord, uint level) {
	return fp24_8(max_cell_value(level) - (coord.value & mask(level)));
}

#define CELL_POS_INIT(__name, __x, __y) \
void __name (inout cell_pos pos, uint level, uvec2_fp22_10 dir) { \
	pos.t.x = __x (pos.m.x, level); \
	pos.t.y = __y (pos.m.y, level); \
	pos.t = div(pos.t, dir); \
}

CELL_POS_INIT(cell_pos_init_ru, dist_positive, dist_positive)
CELL_POS_INIT(cell_pos_init_rd, dist_positive, dist_negative)
CELL_POS_INIT(cell_pos_init_lu, dist_negative, dist_positive)
CELL_POS_INIT(cell_pos_init_ld, dist_negative, dist_negative)

#define CELL_POS_INIT_STRAIGHT(__name, __element, __dist_func) \
void __name (inout cell_pos pos, uint level, uvec2_fp22_10 dir) { \
	pos.t = uvec2_fp24_8_from_uvec2(uvec2(0u - 1u)); \
	pos.t. __element = __dist_func (pos.m. __element, level); \
}

CELL_POS_INIT_STRAIGHT(cell_pos_init_u, y, dist_positive)
CELL_POS_INIT_STRAIGHT(cell_pos_init_r, x, dist_positive)
CELL_POS_INIT_STRAIGHT(cell_pos_init_d, y, dist_negative)
CELL_POS_INIT_STRAIGHT(cell_pos_init_l, x, dist_negative)

#define NEXT_CELL(__name, __x_op, __y_op, __x_dist_func, __y_dist_func) \
float __name (inout cell_pos pos, uint level, uvec2_fp22_10 dir) { \
	fp24_8 cs = fp24_8( max_cell_value(level) ); \
	fp24_8 dist = fp24_8( 0u ); \
	if(pos.t.x.value < pos.t.y.value) { \
		fp24_8 x_d = __x_dist_func (pos.m.x, level); \
		pos.m.x = __x_op (pos.m.x, x_d); \
		pos.m.y = __y_op (pos.m.y, div(mul(x_d, dir.y), dir.x)); \
		dist = div(x_d, dir.x); \
		pos.t.x = add(pos.t.x, div(cs, dir.x)); \
	} \
	else { \
		fp24_8 y_d = __y_dist_func (pos.m.y, level); \
		pos.m.y = __y_op (pos.m.y, y_d); \
		pos.m.x = __x_op (pos.m.x, div(mul(y_d, dir.x), dir.y)); \
		dist = div(y_d, dir.y); \
		pos.t.y = add(pos.t.y, div(cs, dir.y)); \
	} \
	return fp24_8_as_float(dist); \
}

NEXT_CELL(next_cell_ru, add, add, dist_positive, dist_positive)
NEXT_CELL(next_cell_rd, add, sub, dist_positive, dist_negative)
NEXT_CELL(next_cell_lu, sub, add, dist_negative, dist_positive)
NEXT_CELL(next_cell_ld, sub, sub, dist_negative, dist_negative)

#define NEXT_CELL_STRAIGHT(__name, __element, __op, __dist_func) \
float __name (inout cell_pos pos, uint level, uvec2_fp22_10 dir) { \
	fp24_8 dist = __dist_func(pos.m. __element, level); \
	pos.m. __element =  __op (pos.m. __element, dist); \
	return fp24_8_as_float(dist); \
}

NEXT_CELL_STRAIGHT(next_cell_u, y, add, dist_positive)
NEXT_CELL_STRAIGHT(next_cell_r, x, add, dist_positive)
NEXT_CELL_STRAIGHT(next_cell_d, y, sub, dist_negative)
NEXT_CELL_STRAIGHT(next_cell_l, x, sub, dist_negative)

float depth_value(cell_pos pos, uint level, uint f) {
	return texelFetch(u_hi_depths, ivec3(uvec2_fp24_8_as_uvec2(pos.m ) >> cell_bits(level), f), int(level)).r;
}

float upper_depth_value(cell_pos pos, uint level, uint f) {
	return level < last_level ? depth_value(pos, level+1u, f) : 0.0;
}

float lower_depth_value(cell_pos pos, uint level, uint f) {
	return depth_value(pos, level, f);
}

void find_lowest_lod(inout cell_pos pos, inout uint level, inout float upper_depth, inout float lower_depth, uint f) {
	while(level > 0u && pos.z >= lower_depth) {
		--level;
		upper_depth = lower_depth;
		lower_depth = lower_depth_value(pos, level, f);
	}
}

bool find_uppest_lod(inout cell_pos pos, inout uint level, inout float upper_depth, inout float lower_depth, uint f) {
	int i = 0;
	for(; level < last_level && pos.z < upper_depth; ++i) {
		++level;
		lower_depth = upper_depth;
		upper_depth = upper_depth_value(pos, level, f);
	}
	return i > 0;
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
	vec3 normal_ws = normalize(texelFetch(u_win_normals, ivec3(o, int(f)), 0).xyz / vec3(frxu_size, 1.));
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
	uint level = 0u; \
	float lower_depth = 0.0; \
	float upper_depth = upper_depth_value(pos, level, f); \
	if(!find_uppest_lod(pos, level, upper_depth, lower_depth, f)) { \
		lower_depth = lower_depth_value(pos, level, f); \
	} \
	float dir_z_per_xy = dir.z / length(dir.xy); \
	\
	while(true) { \
		if(is_out_of_fb(pos)) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, cell_pos(zero_uvec2_fp24_8(), zero_uvec2_fp24_8(), 0.0)); \
		\
		__init_func (pos, level, udir); \
		cell_pos prev = pos; \
		float dist = __next_func (pos, level, udir); \
		pos.z += dist * dir_z_per_xy; \
		\
		if(pos.z >= lower_depth) { \
			if(level > 0u) { \
				float mul = (lower_depth - prev.z) / (pos.z - prev.z); \
				dist *= mul; \
				pos.m = add(prev.m, dist * dir_xy); \
				pos.z = lower_depth; \
				find_lowest_lod(pos, level, upper_depth, lower_depth, f); \
				continue; \
			} \
			else { \
				int result = check_if_intersected(prev, dir, f); \
				if(result == SURFACE_INTERSECT) \
					return fb_traversal_result(TRAVERSAL_SUCCESS, prev); \
				else if(result == SURFACE_UNDER) \
					return fb_traversal_result(TRAVERSAL_POSSIBLY_UNDER, cell_pos(zero_uvec2_fp24_8(), zero_uvec2_fp24_8(), 0.0)); \
			} \
		} \
		\
		/* switching the cell */ \
		if((uvec2_fp24_8_as_uvec2(pos.m) >> cell_bits(level + 1u)) != (uvec2_fp24_8_as_uvec2(prev.m) >> cell_bits(level + 1u) )) { \
			upper_depth = upper_depth_value(pos, level, f); \
		} \
		if(!find_uppest_lod(pos, level, upper_depth, lower_depth, f)) { \
			lower_depth = lower_depth_value(pos, level, f); \
			find_lowest_lod(pos, level, upper_depth, lower_depth, f); \
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

fb_traversal_result traverse_fb(vec3 dir, vec3 pos, uint f) {
	if(dir.x == 0.0 && dir.y == 0.0) {
		uvec2 upos = uvec2(pos.xy);
		float d = texelFetch(u_depths, ivec3(upos, f), 0).r;

		if(dir.z > 0 && d >= pos.z)
			return fb_traversal_result(TRAVERSAL_SUCCESS, cell_pos(uvec2_fp24_8_from_uvec2(upos), zero_uvec2_fp24_8(), d));

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
	
		lights[i] = color*pow(block_light, 4);
		colors[i] = color*(1.0 - pow(block_light, 4));

		if(i >= max_index) break;

		vec3 normal_cs = texelFetch(u_normals, ivec3(pos_ws.xy, 0), 0).xyz;
		if(length(normal_cs) < 0.5) {
			break;
		}

		++i;

		vec2 rand = hash22(pos_ws.xy);

		float cosa = dot(-incidence_cs, normal_cs);
		if(cosa < 0.) break;
		float angle = acos(cosa);

		float max_angle = 3.1416 / 2.0 - angle;
		float r = (1. - reflectivity) * 3.1416 / 2.0;
		float x = (rand.x * 2.0 - 1.0) * r;

		vec3 new_normal_cs = rotation(
			x,
			normalize(cross(-incidence_cs, normal_cs))
		) * normal_cs;

		if(x > max_angle)
			cosa = max_angle / x;
		else 
			cosa = 1.0;
		
		max_angle = acos(cosa);
		float y = max_angle + (3.1416 - max_angle) * (rand.y * 2.0);

		normal_cs = rotation(y, normal_cs ) * new_normal_cs;

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
			color = pow3(texelFetch(u_colors, ivec3(outer_as_uvec2(res.pos.m), 0), 0).rgb, 2.2);
			pos_ws.xy = uvec2_fp24_8_as_vec2(res.pos.m);
			pos_ws.z = res.pos.z;
		}
		/*else if(res.code == TRAVERSAL_POSSIBLY_UNDER) {
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
		}*/
		else {
			vec3 light = sky_color(mat3(frx_inverseViewMatrix) * reflection_dir);
			lights[i] = light * sky_light*sky_light;
			break;
		}

		incidence_cs = reflection_dir;
	}

	color = lights[i];

	while(--i >= 0) {
		color = color * colors[i] + lights[i];
	}

	out_color = vec4(pow3(color, 1.0 / 2.2), 1.0);
}