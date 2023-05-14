#include canvas:shaders/pipeline/pipeline.glsl
#include lomo:shaders/sky.glsl

uniform sampler2D u_blended_without_particles_color;
uniform sampler2D u_blended_without_particles_depth;

uniform sampler2D u_blended_color;
uniform sampler2D u_blended_normal;
uniform sampler2D u_blended_data;
uniform sampler2D u_blended_depth;

uniform sampler2D u_solid_color;
uniform sampler2D u_solid_depth;
uniform sampler2D u_translucent_depth;
uniform sampler2D u_translucent_color;

uniform samplerCube u_skybox;

layout(location = 0) out vec3 out_color;

bool traverse(
	vec3 pos, vec3 dir, int steps, out ivec2 hit_pos, out float hit_z, out float hit_depth
) {
	const uint power_of_two = 2u;
	const uint last_level = 8u;

	pos.z -= max(0.0, dir.z * 4.0);
	pos.z -= 1.0 / 1000000.0;

	float dir_xy_length = length(dir.xy);
	vec2 dir_xy = dir.xy / dir_xy_length;
	vec2 sgn_xy = sign(dir_xy);
	dir_xy *= sgn_xy;
	ivec2 isgn_xy = ivec2(sgn_xy);

	// shift[x] is 1u if isgn_xy[i] is -1, 0u otherwise
	uvec2 shift = uvec2((-isgn_xy + 1) / 2);
	uvec2 texel = uvec2(ivec2(pos.xy * sgn_xy)) - shift;
	vec2 inner = fract(pos.xy * sgn_xy);
	float z = pos.z;

	while(steps > 0) {
		--steps;

		ivec2 itexel = ivec2(texel + shift) * isgn_xy;

		if( // check if out of buffer bounds
			any(greaterThanEqual(uvec2(itexel), uvec2(frxu_size))) ||
			z <= 0.0
		) {
			break;
		}

		uint level = last_level;
		float upper_depth = texelFetch(u_blended_without_particles_depth, itexel >> last_level, int(last_level)).r;

		while(z >= upper_depth && level > 0u) {
			level -= power_of_two;
			upper_depth = texelFetch(u_blended_without_particles_depth, itexel >> level, int(level)).r;
		}
		// position before advance
		uvec2 prev_texel = texel;
		vec2 prev_inner = inner;
		float prev_z = z;

		float dist_xy; { // advance, save travelled distance in dist_xy
			uint cell_size = 1u << level; // 1, 4, 16, etc...
			vec2 position_in_cell = (texel & (cell_size - 1u)) + inner;

			vec2 dists_to_axis = cell_size - position_in_cell;
			vec2 diagonal_dists = dists_to_axis / dir_xy;

			uint closest_dim = diagonal_dists.x < diagonal_dists.y ? 0u : 1u;
			dist_xy = diagonal_dists[closest_dim];

			texel[closest_dim] = ((texel[closest_dim] >> level) + 1u) << level;
			inner[closest_dim] = 0.0;

			uint farther_dim = 1u - closest_dim;
			float farther_dist = inner[farther_dim] + dir_xy[farther_dim] * dist_xy;
			uint ufarther_dist = uint(farther_dist);

			texel[farther_dim] += ufarther_dist;
			inner[farther_dim] = farther_dist - ufarther_dist;
		}
		// z addition = dir.z per len(dir.xy) * distance
		z += dist_xy * (dir.z / dir_xy_length);
		// we didn't hit upper depth yet, continue advancing
		if(z < upper_depth) continue;

		if(level == 0u) {
			hit_pos = itexel;
			hit_z = z;
			hit_depth = upper_depth;
			return true;
		}
		// restore position to hit point
		dist_xy *= (upper_depth - prev_z) / (z - prev_z);

		vec2 diff = prev_inner + dist_xy * dir_xy;
		uvec2 udiff = uvec2(diff);
		inner = diff - udiff;
		texel = prev_texel + udiff;

		z = upper_depth;
	}

	return false;
}

void main() {
	vec3 color = texelFetch(u_blended_color, ivec2(gl_FragCoord.xy), 0).rgb;
	vec3 normal = texelFetch(u_blended_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	vec3 data = texelFetch(u_blended_data, ivec2(gl_FragCoord.xy), 0).xyz;
	float depth = texelFetch(u_blended_depth, ivec2(gl_FragCoord.xy), 0).x;
	vec3 pos_win = vec3(gl_FragCoord.xy, depth);

	vec3 dir; {
		vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
		vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

		vec4 world_near0 = frx_inverseViewProjectionMatrix * vec4(ndc_near, 1.0);
		vec4 world_far0  = frx_inverseViewProjectionMatrix * vec4(ndc_far, 1.0);
		vec3 world_near = world_near0.xyz / world_near0.w;
		vec3 world_far  = world_far0.xyz  / world_far0.w;

		dir = normalize(world_far - world_near);
	}

	if(normal == vec3(0.0)) {
		out_color = depth  == 1.0 ? sky(dir) : color;
		return;
	}

	vec3 n = mat3(frx_inverseViewMatrix) * normal;

	float solid_depth = texelFetch(u_solid_depth, ivec2(gl_FragCoord.xy), 0).x;
	vec3 solid_pos_cam = win_to_cam(vec3(gl_FragCoord.xy, solid_depth));

	float translucent_depth = texelFetch(u_translucent_depth, ivec2(gl_FragCoord.xy), 0).x;
	vec3 translucent_pos_cam = win_to_cam(vec3(gl_FragCoord.xy, translucent_depth));

	/*if(translucent_depth < solid_depth) {
		float dist = distance(translucent_pos_cam, solid_pos_cam);
		vec4 translucent_color = texelFetch(u_translucent_color, ivec2(gl_FragCoord.xy), 0);
		translucent_color.rgb = pow(translucent_color.rgb, vec3(2.0));
		vec3 solid_color = pow(texelFetch(u_solid_color, ivec2(gl_FragCoord.xy), 0).rgb, vec3(2.2));
		translucent_color.a = 1.0 - exp(-dist * translucent_color.a);
		color = (solid_color * (1.0 - translucent_color.a)) + translucent_color.rgb;
	}*/

	vec3 reflect_dir = reflect(dir, n);

	if(depth < 1.0 && data.z < 0.1) {
		vec3 ndc = pos_win / vec3(frxu_size, 1.0) * 2.0 - 1.0;
		vec4 d = frx_viewProjectionMatrix * vec4(reflect_dir, 0.0);
		vec3 dir_win = normalize(
			(d.xyz - ndc.xyz * d.w) * vec3(frxu_size, 1.0)
		);

		ivec2 hit_pos;
		float hit_z;
		float hit_depth;

		bool result = traverse(pos_win, dir_win, 48, hit_pos, hit_z, hit_depth);

		vec3 pos_at_depth = win_to_cam(vec3(vec2(hit_pos) + 0.5, hit_depth));
		vec3 pos_at_z = win_to_cam(vec3(vec2(hit_pos) + 0.5, hit_z));

		vec3 reflected_color;

		if(
			result &&
			!(length(pos_at_z) > length(pos_at_depth) && distance(pos_at_z, pos_at_depth) > length(pos_at_depth) / 4.0) &&
			hit_depth < 1.0
		) {
			reflected_color = texelFetch(u_blended_without_particles_color, hit_pos, 0).rgb;
		}
		else {
			reflected_color = sky(reflect_dir);
		}

		color = mix(
			reflected_color,
			color,
			pow(max(0.0, dot(reflect_dir, n)), 1.0 / 2.0)
		);
	}

	out_color = color;
}