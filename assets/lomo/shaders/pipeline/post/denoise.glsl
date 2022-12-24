#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/pipeline/post/shadow.glsl

uniform sampler2D u_light;
uniform sampler2D u_normal;
uniform sampler2D u_extra_0;
uniform sampler2D u_depth;
uniform sampler2D u_ratio;
uniform sampler2D u_shadow;

layout(location = 0) out vec3 out_post_1_denoised_0;

void main() {
	float total_weight = 0.0;
	vec3 light = vec3(0.0);
	vec3 normal_0 = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;

	if(dot(normal_0, normal_0) < 0.8) {
		out_post_1_denoised_0 = vec3(0.0);
		return;
	}

	vec3 extra_0_0 = texelFetch(u_extra_0, ivec2(gl_FragCoord.xy), 0).rgb;
	float roughness_0 = clamp(extra_0_0[0], 0.0, 1.0);
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	float ratio_0 = texelFetch(u_ratio, ivec2(gl_FragCoord.xy), 0).r;
	float shadow_0 = texelFetch(u_shadow, ivec2(gl_FragCoord.xy), 0).r;
	ratio_0 = clamp(ratio_0, 0.0, 1.0);

	vec3 pos_0 = win_to_cam(vec3(gl_FragCoord.xy, depth_0));
	vec3 l_0 = texelFetch(u_light, ivec2(gl_FragCoord.xy), 0).rgb;
	l_0 = max(l_0, vec3(0.0));

	float max_ratio = 1024.0 * pow(roughness_0, 1.5);
	max_ratio = 1.0 - 1.0 / max_ratio;

	float radius =
		pow(2.0, POW) *
		((max_ratio - ratio_0) / 2.0 + pow(roughness_0, 1.5));//clamp(roughness_0 * 2.0 - ratio_0, 0.0, 1.0);

	radius = clamp(radius, 0.0001, pow(2.0, POW));
	float variance = 0.3 * pow(radius, 2.0);

	for(int x = -2; x <= 2; ++x) {
		for(int y = -2; y <= 2; ++y) {
			vec2 off = vec2(x, y) / 2.0 * radius;
			ivec2 coord_i = ivec2(gl_FragCoord.xy + off);
			vec2 coord = vec2((gl_FragCoord.xy + off) / frxu_size.xy);

			vec3 normal =
				texelFetch(u_normal, coord_i, 0).xyz;
				//texture(u_normal, coord).xyz;

			vec3 extra_0 =
				texelFetch(u_extra_0, coord_i, 0).rgb;
				//texture(u_extra_0, coord).rgb;
			float roughness = clamp(extra_0[0], 0.0, 1.0);
			float depth =
				texelFetch(u_depth, coord_i, 0).r;
				//texture(u_depth, coord).r;

			float shadow =
				texelFetch(u_shadow, coord_i, 0).r;
				//texture(u_shadow, coord).r;

			vec3 pos = win_to_cam(vec3(gl_FragCoord.xy + off, depth));

			float z_diff = abs(dot(pos - pos_0, normal_0));

			float weight = exp(-(
				float(dot(off, off))
			) / (2 * variance) );

			weight *= pow(max(0.0, dot(normal_0, normal)), 64.0);
			weight *= 1.0 - min(abs(shadow_0 - shadow), 1.0);
			//weight *= 1.0 - min(z_diff * 32.0, 1.0);

			if(
				roughness != roughness_0 ||
				any(greaterThan(coord, vec2(1.0))) ||
				any(lessThan(coord, vec2(0))) ||
				dot(normal, normal) < 0.8
			) {
				weight = 0.0;
			}

			vec3 l =
				texelFetch(u_light, coord_i, 0).rgb;
				//texture(u_light, coord).rgb;
			l = max(l, vec3(0.0));
			light += l * weight;
			total_weight += weight;
		}
	}

	if(total_weight > 0.0) {
		light /= total_weight;
	}

	out_post_1_denoised_0 = light;
}