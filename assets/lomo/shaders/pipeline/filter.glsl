#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl

#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/filter.glsl */

uniform sampler2D u_lights;
//uniform sampler2DArray u_derivatives;
uniform sampler2D u_extras_0;
uniform sampler2D u_normals;
uniform sampler2D u_depths;

layout(location = 0) out vec4 out_denoised_light;

void main() {
	vec3 result = vec3(0.0);
	ivec2 xy = ivec2(gl_FragCoord.xy);
	float total = 0;

	vec3 main_light = texelFetch(u_lights, ivec2(xy), 0).rgb;
	vec3 main_extra = texelFetch(u_lights, ivec2(xy), 0).rgb;

	float main_roughness = texelFetch(u_extras_0, ivec2(xy), 0).x;
	vec3 main_normal = texelFetch(u_normals, ivec2(xy), 0).rgb;

	float main_depth = texelFetch(u_depths, ivec2(xy), 0).r;
	vec3 main_pos = win_to_cam(vec3(gl_FragCoord.xy, main_depth));

	int r = R;

	for(int x = -r; x <= r; ++x) {
		ivec2 coord = xy + ivec2(
			#ifdef HORIZONTAL
				x, 0
			#endif
			#ifdef VERTICAL
				0, x
			#endif
		);

		float roughness = texelFetch(u_extras_0, ivec2(coord), 0).r;

		vec3 light = texelFetch(u_lights, ivec2(coord), 0).rgb;

		vec3 normal = texelFetch(u_normals, ivec2(coord), 0).rgb;
		float depth_ws = texelFetch(u_depths, ivec2(coord), 0).r;
		vec3 pos = win_to_cam(vec3(vec2(coord) + vec2(0.5), depth_ws));

		float z_diff = abs(dot(pos - main_pos, main_normal));

		//float deviation = 32.0 * (main_roughness + 0.0001);
		float d0 = 1.0 - smoothstep(0.0, r, distance(xy, coord));//1.0 / (deviation * sqrt(2.0 * 3.14)) * exp(-0.5 * pow(distance(xy, coord) / deviation, 2.0));//1.0 - smoothstep(0.0, r, distance(main_pos.xy, pos.xy));//max(0.0, exp(-z_diff*5.));
		//if(dot(normal, normal) < 0.4) {
		//	d0 = 0.0;
		//}
		d0 *= max(0.0, pow(dot(main_normal, normal), 4.0));//max(0.0, exp(-z_diff));
		//d0 *= max(0.0, 0.1 - z_diff);

		total += d0;
		vec3 c0 = light * d0;
		result += c0;
	}

	out_denoised_light = vec4(vec3(result / total), 1.0);
}