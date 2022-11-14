#include lomo:shaders/lib/ray_plane.glsl

struct fb_pos {
	uvec2 texel;
	vec2 inner;
	float z;
};

struct fb_traversal_result {
	fb_pos pos;
	bool success;
};

const uint power = 2u;
const uint levels = 4u;
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

	float dir_ws_length = length(dir_ws.xy);
	vec2 dir_xy = dir_ws.xy / dir_ws_length;

	uint level = 0u;
	float lower_depth = texelFetch(s_hi_depth, ivec2(pos.texel), 0)[level];
	float upper_depth = texelFetch(s_hi_depth, ivec2(pos.texel), 0)[level + 1];
	//float lower_depth = texelFetch(s_hi_depth, ivec3(pos.texel, level), 0).r;
	//float upper_depth = texelFetch(s_hi_depth, ivec3(pos.texel, level + 1), 0).r;

	fb_traversal_result result = fb_traversal_result(pos, false);
	while(max_steps > 0) {
		--max_steps;

		fb_pos prev = pos;
		float dist = next_cell_common(pos, dir_xy, level);
		pos.z += dist * (dir_ws.z / dir_ws_length);

		int result_code = -1;

		if(pos.z > lower_depth || (!backwards && pos.z == lower_depth)) {
			if(level == 0u && !is_out_of_fb(pos) && !result.success) {
				result = fb_traversal_result(prev, true);
			}
			float mul = (lower_depth - prev.z) / (pos.z - prev.z);
			dist *= mul;

			vec2 diff = prev.inner + dist * dir_xy;

			pos.inner = fract(diff);
			pos.texel = prev.texel + uvec2(ivec2(floor(diff)));
			pos.z = lower_depth;
		}

		vec4 depths_raw = texelFetch(s_hi_depth, ivec2(pos.texel), 0);
		float[4] depths = float[4](
			depths_raw[0], depths_raw[1], depths_raw[2], depths_raw[3]
		);
		/*float[4] depths = float[4](
			texelFetch(s_hi_depth, ivec3(pos.texel, 0), 0).r,
			texelFetch(s_hi_depth, ivec3(pos.texel, 1), 0).r,
			texelFetch(s_hi_depth, ivec3(pos.texel, 2), 0).r,
			texelFetch(s_hi_depth, ivec3(pos.texel, 3), 0).r
		);*/

		/* switching the cell */
		upper_depth = (level + 1) < levels ? depths[level + 1] : 1.0;
		lower_depth = depths[level];

		while(level < last_level && (pos.z < upper_depth || (backwards && pos.z == upper_depth))) {
			++level;
			lower_depth = upper_depth;
			upper_depth = (level + 1) < levels ? depths[level + 1] : 1.0;
		}

		while(level > 0u && (pos.z > lower_depth || (!backwards && pos.z == lower_depth))) {
			--level;
			upper_depth = lower_depth;
			lower_depth = depths[level];
		}
	}

	return result;
}