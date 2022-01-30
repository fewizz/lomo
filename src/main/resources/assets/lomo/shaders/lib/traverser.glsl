#include lomo:shaders/lib/fixed_point.glsl

#define TRAVERSAL_SUCCESS 0
#define TRAVERSAL_OUT_OF_FB 1
#define TRAVERSAL_POSSIBLY_UNDER 2
#define TRAVERSAL_TOO_LONG 3

struct fb_pos {
	ufp16vec2 texel;
	float z;
};

struct fb_traversal_result {
	int code;
	fb_pos pos;
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

float depth_value(fb_pos pos, uint level, sampler2D s_hi_depth) {
	return texelFetch(s_hi_depth, ufp16vec2_as_uvec2(pos.texel) >> cell_bits(level), int(level)).r;
}

float upper_depth_value(fb_pos pos, uint level, sampler2DArray s_hi_depth) {
	return level < last_level ? depth_value(pos, level+1u, s_hi_depth) : 0.0;
}

float lower_depth_value(fb_pos pos, uint level, sampler2DArray s_hi_depth) {
	return depth_value(pos, level, s_hi_depth);
}

void find_lowest_lod(
	inout fb_pos pos,
	inout uint level,
	inout float upper_depth,
	inout float lower_depth,
	sampler2DArray s_hi_depth,
	bool backwards,
	uint f
) {
	while(level > 0u && (pos.z > lower_depth || (!backwards && pos.z == lower_depth))) {
		--level;
		upper_depth = lower_depth;
		lower_depth = lower_depth_value(pos, level, s_hi_depth);
	}
}

bool find_uppest_lod(
	inout fb_pos pos,
	inout uint level,
	inout float upper_depth,
	inout float lower_depth,
	sampler2DArray s_hi_depth,
	bool backwards,
	uint f
) {
	int i = 0;
	for(; level < last_level && (pos.z < upper_depth || (backwards && pos.z == upper_depth)); ++i) {
		++level;
		lower_depth = upper_depth;
		upper_depth = upper_depth_value(pos, level, s_hi_depth);
	}
	return i > 0;
}

bool is_out_of_fb(fb_pos pos) {
	return
		any(greaterThanEqual(outer_as_uvec2(pos.texel), uvec2(frxu_size))) ||
		pos.z < 0.0 || pos.z >= 1.0;
}

#define SURFACE_DONT_INTERSECT 0
#define SURFACE_INTERSECT 1
#define SURFACE_UNDER 2

int check_if_intersects(inout fb_pos pos, vec3 dir, sampler2D s_depth, sampler2D s_win_normal) {
	uvec2 o = outer_as_uvec2(pos.texel);
	float real_depth = texelFetch(s_depth, vec2(o), 0).r;
	vec3 normal_ws = normalize(texelFetch(s_win_normal, vec2(o), 0).xyz / vec3(frxu_size, 1.));
	plane p = plane_from_pos_and_normal(vec3(vec2(0.5), real_depth), normal_ws);
	vec3 ray_pos = vec3(inner_as_vec2(pos.texel), pos.z);
	float depth_at_pos = ray_plane_intersection(ray(ray_pos, vec3(0, 0, 1)), p).dist;
	if(depth_at_pos < 0.0) return SURFACE_UNDER;
	ray r = ray(ray_pos, dir);
	ray_plane_intersection_result res = ray_plane_intersection(r, p);
	vec3 intersection_pos = r.pos + r.dir * res.dist;

	if(
		(dot(normal_ws, dir) > 0 && res.dist == 0) ||
		res.dist < 0. || any(lessThan(intersection_pos.xy, vec2(0.0))) || any(greaterThan(intersection_pos.xy, vec2(1.0)))
	) {
		return SURFACE_DONT_INTERSECT;
	}

	pos.z = intersection_pos.z;
	pos.texel = add(clean_inner(pos.texel), ufp16vec2_from_vec2(intersection_pos.xy));
	return SURFACE_INTERSECT;
}

fb_traversal_result traverse_fb(
	fb_pos pos,
	vec3 dir_ws,
	sampler2D s_hi_depth,
	sampler2D s_depth,
	sampler2D s_win_normal
) {
	vec2 dir_xy = normalize(dir_ws.xy);
	fp16vec2 dir = fp16vec2_from_vec2(dir_xy);
	bool backwards = dir_ws.z < 0.0;

	if(length(dir_ws.xy) == 0 || (dir.x.value == 0 && dir.y.value == 0)) {
		float z = pos.z;
		float depth = texelFetch(s_depth, outer_as_uvec2(pos.texel), 0).r;
		pos.z = depth;

		if(!backwards && depth < 1.0) {
			if(z <= depth)
				return fb_traversal_result(TRAVERSAL_SUCCESS, pos);
			else
				return fb_traversal_result(TRAVERSAL_POSSIBLY_UNDER, pos);
		}
		return fb_traversal_result(TRAVERSAL_OUT_OF_FB, pos);
	}

	uint level = 0u;
	float lower_depth = 0.0;
	float upper_depth = upper_depth_value(pos, level, s_hi_depth);
	if(!find_uppest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards)) {
		lower_depth = lower_depth_value(pos, level, s_hi_depth);
	}
	float dir_z_per_xy = dir_ws.z / length(dir_ws.xy);
	
	while(true) {
		if(is_out_of_fb(pos)) return fb_traversal_result(TRAVERSAL_OUT_OF_FB, pos);

		fb_pos prev = pos;
		float dist = next_cell_common(pos.texel, dir, level);
		pos.z += dist * dir_z_per_xy;
		
		if(pos.z > lower_depth || (!backwards && pos.z == lower_depth)) {
			if(level > 0u) {
				float mul = (lower_depth - prev.z) / (pos.z - prev.z);
				dist *= mul;
				pos.texel = add(prev.texel, dist * dir_xy);
				pos.z = lower_depth;
				find_lowest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
				continue;
			}
			else {
				int result = check_if_intersects(prev, dir_ws, s_depth, s_win_normal);
				if(prev.z >= 1.0)
					return fb_traversal_result(TRAVERSAL_OUT_OF_FB, prev);
				if(result == SURFACE_INTERSECT)
					return fb_traversal_result(TRAVERSAL_SUCCESS, prev);
				if(result == SURFACE_UNDER)
					return fb_traversal_result(TRAVERSAL_POSSIBLY_UNDER, prev);
			}
		}

		/* switching the cell */
		if((ufp16vec2_as_uvec2(pos.texel) >> cell_bits(level + 1u)) != (ufp16vec2_as_uvec2(prev.texel) >> cell_bits(level + 1u) )) {
			upper_depth = upper_depth_value(pos, level, s_hi_depth);
		}
		if(!find_uppest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards)) {
			lower_depth = lower_depth_value(pos, level, s_hi_depth);
			find_lowest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
		}
	}

	return fb_traversal_result(TRAVERSAL_TOO_LONG, fb_pos(zero_ufp16vec2(), 0.0));
}