#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/sky.glsl

/* lomo:pipeline/post_0.frag */

uniform sampler2D u_light_1_accum;
uniform sampler2D u_light_1_accum_counter;

uniform sampler2D u_color_accum;
uniform sampler2D u_color_accum_counter;

uniform sampler2D u_normal;
uniform sampler2D u_color;
uniform sampler2D u_depth;
uniform sampler2D u_extra_0;

layout(location = 0) out vec3 out_prev_light_1_accum;
layout(location = 1) out vec3 out_prev_color_accum;

layout(location = 2) out float out_prev_light_1_accum_counter;
layout(location = 3) out float out_prev_color_accum_counter;

layout(location = 4) out float out_prev_depth;

layout(location = 5) out vec3 out_light;

void main() {
	ivec2 coord0 = ivec2(gl_FragCoord.xy);

	vec3 resulting_light = vec3(0.0);
	vec3 light;

	float depth0 = texelFetch(u_depth, ivec2(coord0), 0).r;

	if(depth0 != 1.0) {
		vec3 pos0 = win_to_cam(vec3(vec2(coord0) + vec2(0.5), depth0));
		vec3 normal0 = texelFetch(u_normal, ivec2(coord0), 0).rgb;
		vec3 light_total = vec3(0.0);
		float weight_total = 0.0;

		vec3 extras_0 = texelFetch(u_extra_0, ivec2(coord0), 0).rgb;
		float roughness = extras_0[0];

		int mx = int(6.0 * pow(roughness, 2.0));
		for(int x = -mx; x <= mx; ++x) {
			for(int y = -mx; y <= mx; ++y) {
				ivec2 coord = coord0 + ivec2(x, y);
				vec3 light = texelFetch(u_light_1_accum, coord, 0).rgb;
				vec3 normal = texelFetch(u_normal, ivec2(coord), 0).rgb;
				float depth_ws = texelFetch(u_depth, ivec2(coord), 0).r;
				vec3 pos = win_to_cam(vec3(vec2(coord) + vec2(0.5), depth_ws));
				float weight = 1.0;
				weight *= max(0.0, pow(max(dot(normal0, normal), 0.0), 4.0));
				float z_diff = abs(dot(pos - pos0, normal0));
				weight *= max(0.0, 0.02 - z_diff);
				weight_total += weight;
				light_total += light * weight;
			}
		}

		light = light_total / weight_total;

		vec3 color = texelFetch(u_color_accum, ivec2(coord0), 0).rgb;
		float block_light = extras_0.z;
		if(depth0 == 1.0) {
			color = vec3(0.0);
			block_light = 1.0;
		}
		resulting_light = light * color + color * block_light;
	}
	else if(frx_worldHasSkylight == 1) {
		resulting_light =
			sky(mat3(frx_inverseViewMatrix) * cam_dir_to_z1(gl_FragCoord.xy), true);
	}

	out_prev_depth = texelFetch(u_depth, coord0, 0).r;

	out_light = resulting_light;

	out_prev_light_1_accum = light;//texelFetch(u_light_1_accum, coord0, 0).rgb;
	out_prev_light_1_accum_counter = texelFetch(u_light_1_accum_counter, coord0, 0).r;

	out_prev_color_accum = texelFetch(u_color_accum, coord0, 0).rgb;
	out_prev_color_accum_counter = texelFetch(u_color_accum_counter, coord0, 0).r;
}