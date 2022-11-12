#include lomo:shaders/lib/ray_plane.glsl

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

float dist_to_axis(uint texel0, float inner0, uint level, float dir0) {
	return dir0 > 0 ?
		dist_positive(texel0, inner0, level) :
		dist_negative(texel0, inner0, level);
}

float next_cell_common(inout fb_pos pos, vec2 dir, uint level) {
	vec2 dists_to_axis = vec2(
		dist_to_axis(pos.texel.x, pos.inner.x, level, dir.x),
		dist_to_axis(pos.texel.y, pos.inner.y, level, dir.y)
	);
	vec2 diagonal_dists = dists_to_axis / abs(dir);

	vec2 dir_signs = sign(dir);

	if(diagonal_dists.x < diagonal_dists.y) {
		pos.texel.x -= pos.texel.x & cell_mask(level);

		if(dir_signs.x > 0.0) {
			pos.texel.x += cell_size(level);
			pos.inner.x = 0.0;
		} else {
			pos.texel.x -= 1u;
			pos.inner.x = 1.0;
		}

		float y = pos.inner.y + dir.y * diagonal_dists.x;
		pos.inner.y = fract(y);
		pos.texel.y += uint(int(floor(y)));
		return diagonal_dists.x;
	} else {
		pos.texel.y -= pos.texel.y & cell_mask(level);

		if(dir_signs.y > 0.0) {
			pos.texel.y += cell_size(level);
			pos.inner.y = 0.0;
		} else {
			pos.texel.y -= 1u;
			pos.inner.y = 1.0;
		}

		float x = pos.inner.x + dir.x * diagonal_dists.y;
		pos.inner.x = fract(x);
		pos.texel.x += uint(int(floor(x)));
		return diagonal_dists.y;
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

bool try_go_lower_lod(
	fb_pos pos,
	inout uint level,
	inout float upper_depth,
	inout float lower_depth,
	sampler2D s_hi_depth,
	bool backwards
) {
	if(level > 0u && (pos.z > lower_depth || (!backwards && pos.z == lower_depth))) {
		--level;
		upper_depth = lower_depth;
		lower_depth = lower_depth_value(pos, level, s_hi_depth);
		return true;
	}
	return false;
}

void find_lowest_lod(
	fb_pos pos,
	inout uint level,
	inout float upper_depth,
	inout float lower_depth,
	sampler2D s_hi_depth,
	bool backwards
) {
	while(try_go_lower_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards));
}

bool try_go_upper_lod(
	fb_pos pos,
	inout uint level,
	inout float upper_depth,
	inout float lower_depth,
	sampler2D s_hi_depth,
	bool backwards
) {
	if(level < last_level && (pos.z < upper_depth || (backwards && pos.z == upper_depth))) {
		++level;
		lower_depth = upper_depth;
		upper_depth = upper_depth_value(pos, level, s_hi_depth);
		return true;
	}
	return false;
}

void find_uppest_lod(
	fb_pos pos,
	inout uint level,
	inout float upper_depth,
	inout float lower_depth,
	sampler2D s_hi_depth,
	bool backwards
) {
	while(try_go_upper_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards));
}

bool is_out_of_fb(vec3 win_pos) {
	return
		any(lessThan(win_pos.xy, vec2(0.0))) ||
		any(greaterThanEqual(win_pos.xy, vec2(frxu_size))) ||
		win_pos.z <= 0.0;
}

bool is_out_of_fb(fb_pos pos) {
	return
		any(greaterThanEqual(pos.texel, uvec2(frxu_size))) ||
		pos.z <= 0.0;
}

#define SURFACE_DONT_INTERSECT 0
#define SURFACE_INTERSECT 1
#define SURFACE_UNDER 2

fb_traversal_result traverse_fb(
	vec3 pos_win,
	vec3 dir_ws,
	sampler2D s_hi_depth,
	uint max_steps
) {
	bool backwards = dir_ws.z < 0.0;
	fb_pos pos = fb_pos(uvec2(pos_win.xy), vec2(fract(pos_win.xy)), pos_win.z);

	if(dir_ws.xy == vec2(0.0) || abs(dir_ws.z) > 0.5) {
		float z = pos.z;
		float depth = texelFetch(s_hi_depth, ivec2(pos.texel), 0).r;
		pos.z = depth;

		if(!backwards && depth < 1.0) {
			if(z <= depth) {
				return fb_traversal_result(TRAVERSAL_SUCCESS, pos);
			}
			return fb_traversal_result(TRAVERSAL_POSSIBLY_UNDER, pos);
		}
		return fb_traversal_result(TRAVERSAL_OUT_OF_FB, pos);
	}

	float dir_ws_length = length(dir_ws.xy);
	vec2 dir_xy = dir_ws.xy / dir_ws_length;

	uint level = 0u;
	float lower_depth = lower_depth_value(pos, level, s_hi_depth);
	float upper_depth = upper_depth_value(pos, level, s_hi_depth);

	while(max_steps > 0) {
		--max_steps;
		if(is_out_of_fb(pos)) {
			return fb_traversal_result(TRAVERSAL_OUT_OF_FB, pos);
		}

		fb_pos prev = pos;
		float dist = next_cell_common(pos, dir_xy, level);
		pos.z += dist * (dir_ws.z / dir_ws_length);

		int result_code = -1;

		if(pos.z > lower_depth || (!backwards && pos.z == lower_depth)) {
			if(level > 0u) {
				float mul = (lower_depth - prev.z) / (pos.z - prev.z);
				dist *= mul;

				vec2 diff = prev.inner + dist * dir_xy;

				pos.inner = fract(diff);
				pos.texel = prev.texel + uvec2(ivec2(floor(diff)));
				pos.z = lower_depth;
			}
			else {
				return fb_traversal_result(TRAVERSAL_SUCCESS, prev);
			}
		}

		/* switching the cell */
		upper_depth = upper_depth_value(pos, level, s_hi_depth);
		lower_depth = lower_depth_value(pos, level, s_hi_depth);
		//find_uppest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
		try_go_upper_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
		//try_go_lower_lod(pos, level, lower_depth, upper_depth, s_hi_depth, backwards);
		//try_go_lower_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
		find_lowest_lod(pos, level, upper_depth, lower_depth, s_hi_depth, backwards);
	}

	return fb_traversal_result(TRAVERSAL_TOO_LONG, pos);
}