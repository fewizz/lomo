#include lomo:shaders/lib/fixed_point.glsl

#define TRAVERSAL_SUCCESS 0
#define TRAVERSAL_OUT_OF_FB 1
#define TRAVERSAL_POSSIBLY_UNDER 2
#define TRAVERSAL_TOO_LONG 3

struct fb_pos {
	uvec2 texel;
	vec2 inner;
	float z;
};

struct fb_traversal_result {
	int code;
	fb_pos pos;
};

const uint power = 2u;
const uint levels = 5u;
const uint last_level = levels - 1u;

uint cell_size(uint level) { return 1u << power * level; }
float cell_size_f(uint level) { return float(cell_size(level)); }
uint cell_mask(uint level) { return cell_size(level) - 1u; }

float position_in_cell(uint texel, float inner, uint level) {
	return float(texel & cell_mask(level)) + inner;
}

vec2 position_in_cell(fb_pos pos, uint level) {
	return vec2(pos.texel & cell_mask(level)) + pos.inner;
}

float dist_negative(uint texel, float inner, uint level) {
	return position_in_cell(texel, inner, level);
}

float dist_positive(uint texel, float inner, uint level) {
	return cell_size_f(level) - dist_negative(texel, inner, level);
}

float diag_for_axis(uint texel0, float inner0, uint level, float dir0) {
	if(dir0 > 0) {
		float axis = dist_positive(texel0, inner0, level);
		float diag = axis / abs(dir0);
		return diag;
	} else
	if(dir0 < 0) {
		float axis = dist_negative(texel0, inner0, level);
		float diag = axis / abs(dir0);
		return diag;
	}
	else
		return 100000000.0F;
}

float next_cell_common(inout fb_pos pos, vec2 dir, uint level) {
	float x = diag_for_axis(pos.texel.x, pos.inner.x, level, dir.x);
	float y = diag_for_axis(pos.texel.y, pos.inner.y, level, dir.y);

	vec2  dir_signs = sign(dir);

	if(x < y) {
		pos.texel.x -= pos.texel.x & cell_mask(level);

		if(dir_signs.x > 0.0) {
			pos.texel.x += cell_size(level);
			pos.inner.x = 0.0;
		} else {
			pos.texel.x -= 1u;
			pos.inner.x = 1.0;
		}

		float y = pos.inner.y + dir.y * x;
		pos.inner.y = fract(y);
		if(y > 0.0) {
			pos.texel.y += uint(y);
		}
		else {
			pos.texel.y -= uint(-y) + 1u;
		}
		return x;
	} else
	if(x > y) {
		pos.texel.y -= pos.texel.y & cell_mask(level);

		if(dir_signs.y > 0.0) {
			pos.texel.y += cell_size(level);
			pos.inner.y = 0.0;
		} else {
			pos.texel.y -= 1u;
			pos.inner.y = 1.0;
		}

		float x = pos.inner.x + dir.x * y;
		pos.inner.x = fract(x);
		if(x > 0.0) {
			pos.texel.x += uint(x);
		}
		else {
			pos.texel.x -= uint(-x) + 1u;
		}
		return y;
	} else {
		pos.texel.x -= pos.texel.x & cell_mask(level);

		if(dir_signs.x > 0.0) {
			pos.texel.x += cell_size(level);
			pos.inner.x = 0.0;
		} else {
			pos.texel.x -= 1u;
			pos.inner.x = 1.0;
		}

		pos.texel.y -= pos.texel.y & cell_mask(level);

		if(dir_signs.y > 0.0) {
			pos.texel.y += cell_size(level);
			pos.inner.y = 0.0;
		} else {
			pos.texel.y -= 1u;
			pos.inner.y = 1.0;
		}

		return x;
	}
}

float depth_value(fb_pos pos, uint level, sampler2D s_hi_depth) {
	return texelFetch(s_hi_depth, ivec2(pos.texel >> power * level), int(level)).r;
}

float upper_depth_value(fb_pos pos, uint level, sampler2D s_hi_depth) {
	return level < last_level ? depth_value(pos, level+1u, s_hi_depth) : 0.0;
}

float lower_depth_value(fb_pos pos, uint level, sampler2D s_hi_depth) {
	return depth_value(pos, level, s_hi_depth);
}

void find_lowest_lod(
	fb_pos pos,
	inout uint level,
	inout float upper_depth,
	inout float lower_depth,
	sampler2D s_hi_depth,
	bool backwards
) {
	while(level > 0u && (pos.z > lower_depth || (!backwards && pos.z == lower_depth))) {
		--level;
		upper_depth = lower_depth;
		lower_depth = lower_depth_value(pos, level, s_hi_depth);
	}
}

void find_uppest_lod(
	fb_pos pos,
	inout uint level,
	inout float upper_depth,
	inout float lower_depth,
	sampler2D s_hi_depth,
	bool backwards
) {
	while(level < last_level && (pos.z < upper_depth || (backwards && pos.z == upper_depth))) {
		++level;
		lower_depth = upper_depth;
		upper_depth = upper_depth_value(pos, level, s_hi_depth);
	}
}

bool is_out_of_fb(vec3 win_pos) {
	return
		any(lessThan(win_pos.xy, vec2(0.0))) ||
		any(greaterThanEqual(win_pos.xy, vec2(frxu_size))) ||
		win_pos.z < 0.0 || win_pos.z >= 1.0;
}

bool is_out_of_fb(fb_pos pos) {
	return
		any(greaterThanEqual(pos.texel, uvec2(frxu_size))) ||
		pos.z < 0.0 || pos.z >= 1.0;
}

#define SURFACE_DONT_INTERSECT 0
#define SURFACE_INTERSECT 1
#define SURFACE_UNDER 2

int check_if_intersects(inout fb_pos pos, vec3 dir_ndc, sampler2D s_depth, sampler2D s_win_normal) {
	float real_depth_win = texelFetch(s_depth, ivec2(pos.texel), 0).r;
	float real_depth_ndc = win_z_to_ndc(real_depth_win);

	vec3 normal_ndc = texelFetch(s_win_normal, ivec2(pos.texel), 0).xyz;
	//normal_ndc.z *= 1.0;
	//normal_ndc = normalize(normal_ndc);

	plane p = plane_from_pos_and_normal(
		vec3(vec2(0.5) / vec2(frxu_size.xy / 2.0), real_depth_ndc),
		normal_ndc
	);

	vec3 ray_pos = vec3(pos.inner / vec2(frxu_size.xy / 2.0), win_z_to_ndc(pos.z));
	float depth_at_pos = ray_plane_intersection(ray(ray_pos, vec3(0, 0, 1)), p).dist;

	if(depth_at_pos < 0.0) return SURFACE_UNDER;

	ray r = ray(ray_pos, dir_ndc);
	ray_plane_intersection_result res = ray_plane_intersection(r, p);
	vec3 intersection_pos = r.pos + r.dir * res.dist;

	if(
		(dot(normal_ndc, dir_ndc) > 0.0 && res.dist == 0.0) ||
		res.dist < 0.0 ||
		any(lessThan(intersection_pos.xy, vec2(0.0))) ||
		any(greaterThan(intersection_pos.xy, vec2(1.0) / vec2(frxu_size.xy / 2.0)))
	) {
		return SURFACE_DONT_INTERSECT;
	}

	pos.z = ndc_z_to_win(intersection_pos.z);
	pos.inner = intersection_pos.xy * vec2(frxu_size.xy / 2.0);
	return SURFACE_INTERSECT;
}

fb_traversal_result traverse_fb(
	fb_pos pos,
	vec3 dir_ws,
	vec3 dir_ndc,
	sampler2D s_hi_depth,
	sampler2D s_depth,
	sampler2D s_win_normal,
	uint max_steps
) {
	bool backwards = dir_ws.z < 0.0;

	if(dir_ws.xy == vec2(0.0) || abs(dir_ws.z) > 0.5) {
		float z = pos.z;
		float depth = texelFetch(s_depth, ivec2(pos.texel), 0).r;
		pos.z = depth;

		if(!backwards && depth < 1.0) {
			if(z <= depth)
				return fb_traversal_result(TRAVERSAL_SUCCESS, pos);
			else
				return fb_traversal_result(TRAVERSAL_POSSIBLY_UNDER, pos);
		}
		return fb_traversal_result(TRAVERSAL_OUT_OF_FB, pos);
	}

	float dir_ws_length = length(dir_ws.xy);
	vec2 dir_xy = dir_ws.xy / dir_ws_length;
	vec2 dir = dir_xy;

	uint level = 0u;
	float lower_depth = lower_depth_value(pos, level, s_hi_depth);
	float upper_depth = upper_depth_value(pos, level, s_hi_depth);
	//find_uppest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
	
	while(max_steps-- > 0) {
		if(is_out_of_fb(pos)) {
			return fb_traversal_result(TRAVERSAL_OUT_OF_FB, pos);
		}

		fb_pos prev = pos;
		float dist = next_cell_common(pos, dir, level);
		pos.z += dist * (dir_ws.z / dir_ws_length);

		if(pos.z > lower_depth || (!backwards && pos.z == lower_depth)) {
			if(level > 0u) {
				float mul = (lower_depth - prev.z) / (pos.z - prev.z);
				dist *= mul;

				vec2 diff = prev.inner + dist * dir_xy;
				float x = diff.x;
				float y = diff.y;

				prev.inner = fract(diff);
				if(y > 0.0) {
					prev.texel.y += uint(y);
				}
				else {
					prev.texel.y -= uint(-y) + 1u;
				}

				if(x > 0.0) {
					prev.texel.x += uint(x);
				}
				else {
					prev.texel.x -= uint(-x) + 1u;
				}

				pos = prev;
				pos.z = lower_depth;
				find_lowest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
				continue;
			}
			else {
				int result = check_if_intersects(prev, dir_ndc, s_depth, s_win_normal);
				if(is_out_of_fb(prev)) {
					return fb_traversal_result(TRAVERSAL_OUT_OF_FB, prev);
				}
				if(result == SURFACE_INTERSECT) {
					return fb_traversal_result(TRAVERSAL_SUCCESS, prev);
				}
				if(result == SURFACE_UNDER) {
					return fb_traversal_result(TRAVERSAL_POSSIBLY_UNDER, prev);
				}
			}
		}

		/* switching the cell */
		upper_depth = upper_depth_value(pos, level, s_hi_depth);
		lower_depth = lower_depth_value(pos, level, s_hi_depth);
		find_uppest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
		find_lowest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
	}

	return fb_traversal_result(TRAVERSAL_TOO_LONG, fb_pos(uvec2(0), vec2(0), 0.0));
}