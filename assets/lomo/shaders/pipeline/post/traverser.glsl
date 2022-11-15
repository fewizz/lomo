#include lomo:shaders/lib/ray_plane.glsl

struct fb_traversal_result {
	uint raw_texel;
	float z;
};

uvec2 fb_traversal_result_texel(fb_traversal_result r) {
	return uvec2(r.raw_texel & 0xFFFFu, r.raw_texel >> 16);
}

bool fb_traversal_result_is_success(fb_traversal_result r) {
	return r.raw_texel != uint(-1);
}

const uint power = 2u;
const uint levels = 4u;
const uint last_level = levels - 1u;

uint cell_size(uint level) { return 1u << power * level; }
float cell_size_f(uint level) { return float(cell_size(level)); }
uint cell_mask(uint level) { return cell_size(level) - 1u; }

float position_in_cell(uint texel, float inner, uint level) {
	return float(texel & cell_mask(level)) + inner;
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

float next_cell_common(inout uvec2 texel, inout vec2 inner, vec2 dir, uint level) {
	vec2 dists_to_axis = vec2(
		dist_to_axis(texel.x, inner.x, level, dir.x),
		dist_to_axis(texel.y, inner.y, level, dir.y)
	);
	vec2 diagonal_dists = dists_to_axis / abs(dir);

	vec2 dir_signs = sign(dir);

	if(diagonal_dists.x < diagonal_dists.y) {
		texel.x -= texel.x & cell_mask(level);

		if(dir_signs.x > 0.0) {
			texel.x += cell_size(level);
			inner.x = 0.0;
		} else {
			texel.x -= 1u;
			inner.x = 1.0;
		}

		float y = inner.y + dir.y * diagonal_dists.x;
		inner.y = fract(y);
		texel.y += uint(int(floor(y)));
		return diagonal_dists.x;
	} else {
		texel.y -= texel.y & cell_mask(level);

		if(dir_signs.y > 0.0) {
			texel.y += cell_size(level);
			inner.y = 0.0;
		} else {
			texel.y -= 1u;
			inner.y = 1.0;
		}

		float x = inner.x + dir.x * diagonal_dists.y;
		inner.x = fract(x);
		texel.x += uint(int(floor(x)));
		return diagonal_dists.y;
	}
}

bool is_out_of_fb(uvec2 texel, float z) {
	return
		any(greaterThanEqual(texel, uvec2(frxu_size))) ||
		z <= 0.0;
}

fb_traversal_result traverse_fb(
	vec3 pos_win,
	vec3 dir_ws,
	sampler2D s_hi_depth,
	uint max_steps
) {
	bool backwards = dir_ws.z < 0.0;
	uvec2 texel = uvec2(pos_win.xy);
	vec2 inner = vec2(fract(pos_win.xy));
	float z = pos_win.z;

	float dir_ws_length = length(dir_ws.xy);
	vec2 dir_xy = dir_ws.xy / dir_ws_length;

	uint level = 0u;
	float lower_depth = texelFetch(s_hi_depth, ivec2(texel), 0)[level];

	fb_traversal_result result = fb_traversal_result(uint(-1), 1.0);

	while(max_steps > 0) {
		--max_steps;

		uvec2 prev_texel = texel;
		vec2 prev_inner = inner;
		float prev_z = z;
		float dist = next_cell_common(texel, inner, dir_xy, level);
		z += dist * (dir_ws.z / dir_ws_length);

		int result_code = -1;

		if(z > lower_depth || (!backwards && z == lower_depth)) {
			if(level == 0u && !is_out_of_fb(prev_texel, z) && !fb_traversal_result_is_success(result)) {
				result = fb_traversal_result(
					uint((prev_texel.x & 0xFFFFu) | (prev_texel.y << 16)),
					prev_z
				);
			}
			float mul = (lower_depth - prev_z) / (z - prev_z);
			dist *= mul;

			vec2 diff = prev_inner + dist * dir_xy;

			inner = fract(diff);
			texel = prev_texel + uvec2(ivec2(floor(diff)));
			z = lower_depth;
		}

		vec4 depths_raw = texelFetch(s_hi_depth, ivec2(texel), 0);
		float[4] depths = float[4](
			depths_raw[0], depths_raw[1], depths_raw[2], depths_raw[3]
		);

		/* switching the cell */
		level = 0;
		lower_depth = depths[0];
		float upper_depth = depths[1];

		while(
			level < last_level &&
			(z < upper_depth || (backwards && z == upper_depth))
		) {
			++level;
			lower_depth = upper_depth;
			upper_depth = (level + 1) < levels ? depths[level + 1] : 1.0;
		}
	}

	return result;
}