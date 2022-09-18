#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/sky.glsl
#include lomo:shaders/pipeline/post/emitting_light.glsl
#include lomo:shaders/pipeline/post/medium.glsl
#include lomo:shaders/pipeline/post/compute_normal.glsl
#include lomo:shaders/pipeline/post/shadow.glsl

/* lomo:pipeline/post_0.frag */

uniform sampler2D u_light_1_accum;
uniform sampler2D u_light_1_accum_counter;

uniform sampler2D u_color_accum;
uniform sampler2D u_color_accum_counter;

uniform sampler2D u_normal;
uniform sampler2D u_color;
uniform sampler2D u_depth;
uniform sampler2D u_extra_0;
uniform sampler2D u_extra_1;

uniform sampler2D u_light_1_pos;

layout(location = 0) out vec3 out_prev_light_1_accum;
layout(location = 1) out vec4 out_prev_color_accum;

layout(location = 2) out float out_prev_light_1_accum_counter;
layout(location = 3) out float out_prev_color_accum_counter;

layout(location = 4) out float out_prev_depth;

layout(location = 5) out vec3 out_light;

float DistributionGGX(vec3 N, vec3 H, float a) {
	float a2     = a*a;
	float NdotH  = max(dot(N, H), 0.0);
	float NdotH2 = NdotH*NdotH;
	
	float nom    = a2;
	float denom  = (NdotH2 * (a2 - 1.0) + 1.0);
	denom        = PI * denom * denom;
	return nom / denom;
}

float GeometrySchlickGGX(float NdotV, float k) {
	float nom   = NdotV;
	float denom = NdotV * (1.0 - k) + k;
	return nom / denom;
}

void main() {
	ivec2 coord0 = ivec2(gl_FragCoord.xy);

	vec3 resulting_light = vec3(0.0);
	vec3 light;

	//vec4 color_accum0 = texelFetch(u_color_accum, coord0, 0);
	float shadow0 = texelFetch(u_color_accum_counter, coord0, 0).r;

	float depth0 = texelFetch(u_depth, ivec2(coord0), 0).r;
	vec3 normal0 = texelFetch(u_normal, ivec2(coord0), 0).xyz;
	vec3 pos0 = win_to_cam(vec3(gl_FragCoord.xy, depth0));

	if(dot(normal0, normal0) < 0.9 && depth0 != 1.0) {
		resulting_light = vec3(0.0);
	}
	else if(depth0 != 1.0) {
		vec3 extras_0 = texelFetch(u_extra_0, ivec2(coord0), 0).rgb;
		vec3 extras_1 = texelFetch(u_extra_1, ivec2(coord0), 0).rgb;
		float roughness   = clamp(extras_0[0], 0.0, 1.0);
		float sky_light   = clamp(extras_0[1], 0.0, 1.0);
		float block_light = clamp(extras_0[2], 0.0, 1.0);
		float reflectance = clamp(extras_1[0], 0.0, 1.0);
		float emissive    = extras_1[1];

		vec3 light_total = vec3(0.0);
		float weight_total = 0.0;
		int mx = int(3.0 * pow(roughness, 1.0));
		for(int x = -mx; x <= mx; ++x) {
			for(int y = -mx; y <= mx; ++y) {
				ivec2 coord = coord0 + ivec2(x, y);
				float shadow = texelFetch(u_color_accum_counter, coord, 0).r;
				vec3 light = pow(texelFetch(u_light_1_accum, coord, 0).rgb, vec3(2.2));
				vec3 normal = texelFetch(u_normal, ivec2(coord), 0).rgb;
				if(dot(normal, normal) < 0.5) continue;
				float depth_ws = texelFetch(u_depth, ivec2(coord), 0).r;
				vec3 pos = win_to_cam(vec3(vec2(coord) + vec2(0.5), depth_ws));
				float z_diff = abs(dot(pos - pos0, normal0));
				float weight = 1.0;
				weight *= exp((
					-dot(vec2(x, y), vec2(x, y)) / float((mx + 1) * (mx + 1)) * 3.0
					-(1.0 - abs(dot(normal0, normal))) * 2.0
					-abs(shadow0 - shadow) * 4.0
					-z_diff * 16.0
				));
				//weight *= max(0.0, pow(max(dot(normal0, normal), 0.0), 4.0));
				//weight *= exp(-abs(shadow0 - shadow) * 8.0);
				//float z_diff = abs(dot(pos - pos0, normal0));
				//weight *= max(0.0, 0.02 - z_diff);
				weight_total += weight;
				light_total += light * weight;
			}
		}
		light = light_total / weight_total;
		//light = texelFetch(u_light_1_accum, coord0, 0).rgb;

		vec3 color = texelFetch(u_color, ivec2(coord0), 0).rgb;
		color = pow(color, vec3(2.2));
		vec3 e = emitting_light(color, block_light, emissive);
		if(depth0 == 1.0) {
			color = vec3(0.0);
			e = vec3(1.0);
		}

		vec3 dir_cam = cam_dir_to_z1(gl_FragCoord.xy);
		float cs = max(0.0001, dot(-dir_cam, normal0));

		/*******/ // From https://learnopengl.com/PBR/Theory
		float F0 = reflectance;
		float kS = F0 + (1.0 - F0) * pow(1.0 - cs, 5.0);
		kS = clamp(kS, 0.0, 1.0);
		/*******/
		kS = mix(kS, 0.0, roughness);
		float kD = 1.0 - kS;

		resulting_light =
			e + (kD * color + kS * (1.0 - roughness * roughness)) * light;
			//e + color * light;
	}
	else if(frx_worldHasSkylight == 1) {
		vec3 wrld_dir = mat3(frx_inverseViewMatrix) * cam_dir_to_z1(gl_FragCoord.xy);
		resulting_light =
			sky(wrld_dir, true);
	}

	vec3 begin = cam_near(gl_FragCoord.xy);
	vec3 end = depth0 == 1.0 ? begin + (pos0 - begin) * 10.0 : pos0;

	resulting_light = medium(resulting_light, begin, end, 1.0);

	out_prev_depth = texelFetch(u_depth, coord0, 0).r;

	out_light = resulting_light;

	out_prev_light_1_accum = pow(light, vec3(1.0 / 2.2));//texelFetch(u_light_1_accum, coord0, 0).rgb;
	out_prev_light_1_accum_counter = texelFetch(u_light_1_accum_counter, coord0, 0).r;

	//out_prev_color_accum = color_accum0;
	out_prev_color_accum_counter = shadow0;
}