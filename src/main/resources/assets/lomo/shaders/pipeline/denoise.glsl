#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl

#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/denoise.glsl */

uniform sampler2DArray u_noise;
//uniform sampler2DArray u_derivatives;
uniform sampler2DArray u_normals;
uniform sampler2DArray u_depths;

layout(location = 0) out vec4 out_denoised_color;
layout(location = 1) out vec4 out_denoised_extra;

void main() {
	vec3 result = vec3(0);
	ivec2 xy = ivec2(gl_FragCoord.xy);
	float dist = 0;

	vec3 main_color = texelFetch(u_noise, ivec3(xy, 0), 0).rgb;
	vec3 main_extra = texelFetch(u_noise, ivec3(xy, 1), 0).rgb;

	vec3 main_normal = texelFetch(u_normals, ivec3(xy, 0), 0).rgb * 2. - 1.;

	float main_depth = texelFetch(u_depths, ivec3(xy, 0), 0).r;
	vec3 main_pos = win_to_cam(vec3(gl_FragCoord.xy, main_depth));

	float reflectivity = main_extra.x;
	int r = int(64*(1 - reflectivity));

	for(int x = -r; x <= r; ++x) {
		ivec2 coord = xy + ivec2(
			#ifdef HOR
				x, 0
			#endif
			#ifdef VER
				0, x
			#endif
		);

		vec3 extra = texelFetch(u_noise, ivec3(coord, 1), 0).rgb;
		float replace = extra.y;
		if(replace == 1.0) continue;

		vec3 color = texelFetch(u_noise, ivec3(coord, 0), 0).rgb;

		vec3 normal = texelFetch(u_normals, ivec3(coord, 0), 0).rgb * 2. - 1.;
		float depth_ws = texelFetch(u_depths, ivec3(coord, 0), 0).r;
		vec3 pos = win_to_cam(vec3(vec2(coord) + vec2(0.5), depth_ws));

		float z_diff = abs(dot(pos - main_pos, main_normal));

		float d0 = max(0.0, exp(-z_diff*5.));
		d0 *= 1. - replace;

		dist += d0;
		vec3 c0 = color * d0;
		result += c0;
	}

	out_denoised_color = vec4(
		result / dist,
		1.0
	);
	out_denoised_extra = vec4(
		reflectivity,
		dist > 0.0 || main_extra.y == 0.0 ? 0.0 : 1.0,
		vec2(0)
	);
}