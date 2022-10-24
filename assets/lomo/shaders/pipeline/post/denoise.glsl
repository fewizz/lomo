#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl

uniform sampler2D u_light;
uniform sampler2D u_normal;
uniform sampler2D u_extra_0;
uniform sampler2D u_depth;

layout(location = 0) out vec3 out_post_1_denoised_0;

void main() {
	float total_weight = 0.0;
	vec3 light = vec3(0.0);
	vec3 normal_0 = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;

	if(dot(normal_0, normal_0) < 0.5) {
		out_post_1_denoised_0 = vec3(0.0);
		return;
	}

	vec3 extra_0_0 = texelFetch(u_extra_0, ivec2(gl_FragCoord.xy), 0).rgb;
	float roughness_0 = extra_0_0[0];
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;

	vec3 pos_0 = win_to_cam(vec3(gl_FragCoord.xy, depth_0));

	for(int x = -2; x <= 2; ++x) {
		for(int y = -2; y <= 2; ++y) {
			vec2 off = vec2(x, y) * SPREAD;
			ivec2 coord = ivec2(gl_FragCoord.xy + off);
			
			vec3 normal = texelFetch(u_normal, coord, 0).xyz;
			if(dot(normal, normal) < 0.5) continue;
			vec3 extra_0 = texelFetch(u_extra_0, coord, 0).rgb;
			float roughness = extra_0[0];
			float depth = texelFetch(u_depth, coord, 0).r;
			vec3 pos = win_to_cam(vec3(gl_FragCoord.xy + off, depth));

			float z_diff = abs(dot(pos - pos_0, normal_0));

			float weight = exp(-(
				dot(vec2(x, y), vec2(x, y)) / pow(2 * float(SPREAD), 2.0) / max(pow(roughness_0, 1.0), 0.0001) +
				length(cross(normal_0, normal)) * 16.0 +
				abs(roughness_0 - roughness) * 32.0 +
				z_diff * 16.0
			));

			total_weight += weight;
			vec3 l = texelFetch(u_light, coord, 0).rgb;
			l = max(l, vec3(0.0));
			l = pow(l, vec3(2.2));
			light += l * weight;
		}
	}
	if(total_weight > 0.0) {
		light /= total_weight;
	}

	out_post_1_denoised_0 = pow(light, vec3(1.0 / 2.2));
}