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
	ufp16vec2 m;
	float z;
};

struct fb_traversal_result {
	int code;
	cell_pos pos;
};

const uint power = 2u;
const uint levels = 5u;
const uint last_level = levels - 1u;

uint cell_bits(uint level) { return 16u + power * level; }
uint max_cell_value(uint level) { return 1u << cell_bits(level); }
uint mask(uint level) { return max_cell_value(level) - 1u; }

ufp16 dist_negative(ufp16 coord, uint level) {
	return ufp16((coord.value & mask(level)) + 1u);
}

ufp16 dist_positive(ufp16 coord, uint level) {
	return ufp16(max_cell_value(level) - (coord.value & mask(level)));
}

ufp16vec2 dists_for_axis(ufp16 pos0, uint level, fp16 dir0) {
	if(dir0.value > 0) {
		ufp16 axis = dist_positive(pos0, level);
		ufp16 diag = div(axis, abs_as_ufp16(dir0));
		return ufp16vec2(axis, diag);
	}
	else if(dir0.value < 0) {
		ufp16 axis = dist_negative(pos0, level);
		ufp16 diag = div(axis, abs_as_ufp16(dir0));
		return ufp16vec2(axis, diag);
	}
	else
		return ufp16vec2(ufp16(0u-1u), ufp16(0u-1u));
}

float next_cell_common(inout ufp16vec2 pos, fp16vec2 dir, uint level) {
	ufp16vec2 x = dists_for_axis(pos.x, level, dir.x);
	ufp16vec2 y = dists_for_axis(pos.y, level, dir.y);

	ufp16vec2 axis_dists = ufp16vec2( x.x, y.x );
	ufp16vec2  dir_dists = ufp16vec2( x.y, y.y );

	if(dir_dists.x.value < dir_dists.y.value) {
		pos.x = add(pos.x, fp16(int(axis_dists.x.value) * sign(dir.x.value)));
		pos.y = add(pos.y, mul(dir_dists.x, dir.y));
		return ufp16_as_float(dir_dists.x);
	}
	else {
		pos.y = add(pos.y, fp16(int(axis_dists.y.value) * sign(dir.y.value)));
		pos.x = add(pos.x, mul(dir_dists.y, dir.x));
		return ufp16_as_float(dir_dists.y);
	}
}

float depth_value(cell_pos pos, uint level, uint f) {
	return texelFetch(u_hi_depths, ivec3(ufp16vec2_as_uvec2(pos.m ) >> cell_bits(level), f), int(level)).r;
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
		pos.z < 0 || pos.z >= 1;
}

#define SURFACE_NOT_INTERSECT 0
#define SURFACE_INTERSECT 1
#define SURFACE_UNDER 2

int check_if_intersects(inout cell_pos pos, vec3 dir, uint f) {
	uvec2 o = outer_as_uvec2(pos.m);
	float real_depth = texelFetch(u_depths, ivec3(o, int(f)), 0).r;
	vec3 normal_ws = normalize(texelFetch(u_win_normals, ivec3(o, int(f)), 0).xyz / vec3(frxu_size, 1.));
	plane p = plane_from_pos_and_normal(vec3(vec2(0.5), real_depth), normal_ws);
	vec3 ray_pos = vec3(inner_as_vec2(pos.m), pos.z);
	float depth_at_pos = ray_plane_intersection(ray(ray_pos, vec3(0, 0, 1)), p).dist;
	if(depth_at_pos < 0.0) return SURFACE_UNDER;
	ray r = ray(ray_pos, dir);
	ray_plane_intersection_result res = ray_plane_intersection(r, p);
	vec3 intersection_pos = ray_pos + dir * res.dist;

	if(
		(dot(normal_ws, dir) > 0 && res.dist == 0) ||
		res.dist < 0. || any(lessThan(intersection_pos.xy, vec2(0.0))) || any(greaterThan(intersection_pos.xy, vec2(1.0)))) {	
		return SURFACE_NOT_INTERSECT;
	}

	pos.z = intersection_pos.z;
	pos.m = add(clean_inner(pos.m), ufp16vec2_from_vec2(intersection_pos.xy));
	return SURFACE_INTERSECT;
}

fb_traversal_result traverse_fb (vec3 dir_ws, vec3 pos_ws, uint f) {
	vec2 dir_xy = normalize(dir_ws.xy);
	fp16vec2 dir = fp16vec2_from_vec2(dir_xy);

	if(length(dir_ws.xy) == 0 || (dir.x.value == 0 && dir.y.value == 0)) {
		float depth = texelFetch(u_depths, ivec3(pos_ws.xy, f), 0).r;
		if(dir_ws.z > 0 && depth >= pos_ws.z)
			return fb_traversal_result(TRAVERSAL_SUCCESS, cell_pos(ufp16vec2_from_vec2(pos_ws.xy), depth));
		else
			return fb_traversal_result(TRAVERSAL_OUT_OF_FB, cell_pos(zero_ufp16vec2(), 0.0));
	}

	cell_pos pos = cell_pos(
		ufp16vec2_from_vec2(pos_ws.xy),
		pos_ws.z
	);
	uint level = 0u;
	float lower_depth = 0.0;
	float upper_depth = upper_depth_value(pos, level, f);
	if(!find_uppest_lod(pos, level, upper_depth, lower_depth, f)) {
		lower_depth = lower_depth_value(pos, level, f);
	}
	float dir_z_per_xy = dir_ws.z / length(dir_ws.xy);
	
	while(true) {
		if(is_out_of_fb(pos)) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, cell_pos(zero_ufp16vec2(), 0.0));

		cell_pos prev = pos;
		float dist = next_cell_common(pos.m, dir, level);
		pos.z += dist * dir_z_per_xy;
		
		if(pos.z >= lower_depth) {
			if(level > 0u) {
				float mul = (lower_depth - prev.z) / (pos.z - prev.z);
				dist *= mul;
				pos.m = add(prev.m, dist * dir_xy);
				pos.z = lower_depth;
				find_lowest_lod(pos, level, upper_depth, lower_depth, f);
				continue;
			}
			else {
				int result = check_if_intersects(prev, dir_ws, f);
				if(result == SURFACE_INTERSECT)
					return fb_traversal_result(TRAVERSAL_SUCCESS, prev);
				else if(result == SURFACE_UNDER)
					return fb_traversal_result(TRAVERSAL_POSSIBLY_UNDER, cell_pos(zero_ufp16vec2(), 0.0));
			}
		}
		
		/* switching the cell */
		if((ufp16vec2_as_uvec2(pos.m) >> cell_bits(level + 1u)) != (ufp16vec2_as_uvec2(prev.m) >> cell_bits(level + 1u) )) {
			upper_depth = upper_depth_value(pos, level, f);
		}
		if(!find_uppest_lod(pos, level, upper_depth, lower_depth, f)) {
			lower_depth = lower_depth_value(pos, level, f);
			find_lowest_lod(pos, level, upper_depth, lower_depth, f);
		}
	}

	return fb_traversal_result(TRAVERSAL_TOO_LONG, cell_pos(zero_ufp16vec2(), 0.0));
}

void main() {
	const int steps = 3;
	const int max_index = steps - 1;
	vec3 lights[steps];
	vec3 colors[steps];

	vec3 pos_ws = vec3(gl_FragCoord.xy, 0.0);

	int i = 0;

	vec3 dir_cs = normalize(win_to_cam(vec3(gl_FragCoord.xy, 1)) - win_to_cam(vec3(gl_FragCoord.xy, 0)));//normalize(win_to_cam(pos_ws) - win_to_cam(vec3(gl_FragCoord.xy, 0)));
	vec3 dir_ws = vec3(0.0, 0.0, 1.0);
	float sky_light = 1.0;

	for(;true; ++i) {
		fb_traversal_result res = traverse_fb(dir_ws, pos_ws, 0u);

		/*if(res.code == TRAVERSAL_POSSIBLY_UNDER) {
			lights[i] = vec3(1.0, 0.0, 0.0);
			break;
		}
		else if(res.code == TRAVERSAL_OUT_OF_FB) {
			lights[i] = vec3(0.0, 1.0, 0.0);
			break;
		}
		else if(res.code == TRAVERSAL_TOO_LONG) {
			lights[i] = vec3(1.0, 0.0, 1.0);
			break;
		}*/

		if(res.pos.z >= 1 || res.code != TRAVERSAL_SUCCESS) {
			vec3 light = sky_color(mat3(frx_inverseViewMatrix) * dir_cs);
			lights[i] = light * sky_light*sky_light;
			break;
		}

		vec3 color = pow3(texelFetch(u_colors, ivec3(outer_as_uvec2(res.pos.m), 0), 0).rgb, 2.2);
		pos_ws.xy = ufp16vec2_as_vec2(res.pos.m);
		pos_ws.z = res.pos.z;

		vec4 extras = texelFetch(u_extras, ivec3(pos_ws.xy, 0), 0);
		float reflectivity = extras.x;
		sky_light = extras.y;
		float block_light = extras.z;
	
		lights[i] = color*pow(block_light, 4);
		colors[i] = color*(1.0 - pow(block_light, 4));

		if(i >= max_index) break;

		vec3 normal_cs = texelFetch(u_normals, ivec3(pos_ws.xy, 0), 0).xyz;
		if(length(normal_cs) < 0.5) {
			break;
		}

		float r = (1. - reflectivity) * 3.1416 / 2.0;
		vec2 rand = hash22(pos_ws.xy);

		vec3 incidence_cs = dir_cs;
		//float cosa = dot(-incidence_cs, normal_cs);
		//float angle = acos(cosa);

		//float max_angle = 3.1416 / 2.0 - angle;
		//float min_angle = -3.1416 / 2.0;
		if(dot(-incidence_cs, normal_cs) < 0) normal_cs *= -1;

		float x = (rand.x * 2.0 - 1.0) * r;

		vec3 new_normal_cs = rotation(
			x,
			normalize(cross(-incidence_cs, normal_cs))
		) * normal_cs;

		float cosa = dot(-incidence_cs, normal_cs);
		float angle = acos(cosa);
		float max_angle = 3.1416 / 2.0 - angle;

		float g = min(r, max_angle);
		if(x > g)
			cosa = g / x;
		else
			cosa = 1.0;
		
		max_angle = acos(cosa);
		float y = max_angle + (3.1416 - max_angle) * (rand.y * 2.0);

		normal_cs = rotation(y, normal_cs ) * new_normal_cs;

		dir_cs = normalize(
			reflect(
				incidence_cs,
				normal_cs
			)
		);

		vec3 pos_cs = win_to_cam(pos_ws);
		dir_ws = cam_dir_to_win(pos_cs, dir_cs);
	}

	vec3 color = lights[i];

	while(--i >= 0) {
		color = color * colors[i] + lights[i];
	}

	out_color = vec4(pow3(color, 1.0 / 2.2), 1.0);
}