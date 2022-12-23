#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/pipeline/post/shadow.glsl

uniform sampler2D u_light;
uniform sampler2D u_normal;
uniform sampler2D u_extra_0;
uniform sampler2D u_depth;
uniform sampler2D u_ratio;

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
	ratio_0 = clamp(ratio_0, 0.0, 1.0);

	vec3 pos_0 = win_to_cam(vec3(gl_FragCoord.xy, depth_0));
	//float shadow_0 = sun_light_at(pos_0);
	vec3 l_0 = texelFetch(u_light, ivec2(gl_FragCoord.xy), 0).rgb;
	l_0 = max(l_0, vec3(0.0));

	float radius = pow(2.0, POW) * mix(1.0, 0.0001, pow(ratio_0, 2.0)) * pow(roughness_0, 0.1);
	radius = max(radius, 0.1);
	float variance = 0.2 * pow(radius, 2.0);

	for(int x = -2; x <= 2; ++x) {
		for(int y = -2; y <= 2; ++y) {
			//int s = int(pow(2, POW));
			//ivec2 off0 = ivec2(x, y);
			//ivec2 off = off0 * s;
			//ivec2 coord = ivec2(gl_FragCoord.xy + off);
			vec2 off = vec2(x, y) / 2.0 * radius;
			vec2 coord = vec2(gl_FragCoord.xy + off);
			coord /= frxu_size.xy;

			if(any(greaterThan(coord, vec2(1.0)))) continue;
			if(any(lessThan(coord, vec2(0)))) continue;
			
			vec3 normal =
				//texelFetch(u_normal, coord, 0).xyz;
				texture(u_normal, coord).xyz;

			if(dot(normal, normal) < 0.8) continue;
			vec3 extra_0 =
				//texelFetch(u_extra_0, coord, 0).rgb;
				texture(u_extra_0, coord).rgb;
			float roughness = clamp(extra_0[0], 0.0, 1.0);
			float depth =
				//texelFetch(u_depth, coord, 0).r;
				texture(u_depth, coord).r;
			vec3 pos = win_to_cam(vec3(gl_FragCoord.xy + off, depth));
			//float shadow = sun_light_at(pos);

			float z_diff = abs(dot(pos - pos_0, normal_0));

			float weight = exp(-(
				float(dot(off, off)) +
				length(cross(normal_0, normal)) * 128.0 * radius// +
				//z_diff * 64.0 * radius
			) / (2 * variance) );
			if(roughness != roughness_0) {
				weight = 0.0;
			}

			vec3 l = //texelFetch(u_light, coord, 0).rgb;
				texture(u_light, coord).rgb;
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