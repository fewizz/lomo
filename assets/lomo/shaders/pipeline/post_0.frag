#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/sky.glsl
#include lomo:shaders/pipeline/post/light_mix.glsl
#include lomo:shaders/pipeline/post/emitting_light.glsl
#include lomo:shaders/pipeline/post/ratio.glsl
#include lomo:shaders/pipeline/post/medium.glsl
#include lomo:shaders/pipeline/post/compute_normal.glsl
#include lomo:shaders/pipeline/post/shadow.glsl

/* lomo:pipeline/post_0.frag */

uniform sampler2D u_normal;
uniform sampler2D u_color;
uniform sampler2D u_depth;
uniform sampler2D u_extra_0;
uniform sampler2D u_extra_1;

uniform sampler2D u_light_1_accum;
uniform sampler2D u_prev_taa;

layout(location = 0) out vec4 out_prev_light_1_accum;
layout(location = 1) out float out_prev_depth;
layout(location = 2) out vec3 out_light;
layout(location = 3) out vec4 out_taa;

void main() {
	ivec2 coord0 = ivec2(gl_FragCoord.xy);
	vec3 extras_0 = texelFetch(u_extra_0, ivec2(coord0), 0).rgb;
	float roughness   = clamp(extras_0[0], 0.0, 1.0);

	vec3 resulting_light = vec3(0.0);
	vec3 light = vec3(0.0);

	float depth0 = texelFetch(u_depth, ivec2(coord0), 0).r;
	vec3 normal0 = texelFetch(u_normal, ivec2(coord0), 0).xyz;
	vec3 pos0 = win_to_cam(vec3(gl_FragCoord.xy, depth0));

	dvec3 r_prev_pos_cam = dvec3(pos0);
	dvec3 r_prev_pos_wrd = cam_to_wrd(r_prev_pos_cam);
	r_prev_pos_wrd += dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos);
	r_prev_pos_cam = transform_pos(
		r_prev_pos_wrd, dmat4(frx_lastViewMatrix)
	);
	dvec3 r_prev_pos_ndc = transform_pos(
		r_prev_pos_cam, dmat4(frx_lastProjectionMatrix)
	);
	dvec3 r_prev_pos_win = ndc_to_win(r_prev_pos_ndc);

	vec3 prev_taa = texture(u_prev_taa, vec2(r_prev_pos_ndc.xy) * 0.5 + 0.5).rgb;
	prev_taa = max(vec3(0.0), prev_taa);
	float taa_ratio = texelFetch(u_prev_taa, ivec2(r_prev_pos_win.xy), 0).w;
	taa_ratio = max(0.0, taa_ratio);
	taa_ratio = increase_ratio(taa_ratio, mix(1.0, 16.0, roughness));

	if(
		any(greaterThan(vec3(r_prev_pos_ndc), vec3( 1.0))) ||
		any(lessThan   (vec3(r_prev_pos_ndc), vec3(-1.0)))
	) {
		taa_ratio = 0.0;
	}
	else {
		taa_ratio *= exp(float(-distance(r_prev_pos_win.xy, gl_FragCoord.xy) * 0.1));
	}

	// sky needs special handling..
	bool all_sky = true;
	vec3 min_prev = vec3(1024.0);
	for(int x = -1; x <= 1; ++x) {
		for(int y = -1; y <= 1; ++y) {
			float depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy) + ivec2(x, y), 0).r;
			all_sky = all_sky && depth == 1.0;
		}
	}
	if(all_sky) {
		taa_ratio = 0.0;
	}

	if(dot(normal0, normal0) < 0.9 && depth0 != 1.0) {
		resulting_light = vec3(0.0);
	}
	else if(depth0 != 1.0) {
		vec3 extras_1 = texelFetch(u_extra_1, ivec2(coord0), 0).rgb;
		float sky_light   = clamp(extras_0[1], 0.0, 1.0);
		float block_light = clamp(extras_0[2], 0.0, 1.0);
		float reflectance = clamp(extras_1[0], 0.0, 1.0);
		float emissive    = extras_1[1];

		vec3 light_total = vec3(0.0);
		float weight_total = 0.0;
		int mx = int(4.0 * pow(roughness, 1.0));
		for(int x = -mx; x <= mx; ++x) {
			for(int y = -mx; y <= mx; ++y) {
				ivec2 coord = coord0 + ivec2(x, y);
				vec3 light = pow(texelFetch(u_light_1_accum, coord, 0).rgb, vec3(2.2));
				vec3 normal = texelFetch(u_normal, ivec2(coord), 0).rgb;
				vec3 extras_0_1 = texelFetch(u_extra_0, ivec2(coord), 0).rgb;
				float roughness_1   = clamp(extras_0_1[0], 0.0, 1.0);
				if(dot(normal, normal) < 0.5) continue;
				float depth_ws = texelFetch(u_depth, ivec2(coord), 0).r;
				vec3 pos = win_to_cam(vec3(vec2(coord) + vec2(0.5), depth_ws));
				float z_diff = abs(dot(pos - pos0, normal0));
				float weight = 1.0;
				weight *= exp(-(
					dot(vec2(x, y), vec2(x, y)) / (mx == 0 ? 1 : float(mx * mx)) * 1.0
					+
					length(cross(normal0, normal)) * 16.0
					+
					abs(roughness - roughness_1) * 32.0
					+
					//-abs(shadow0 - shadow) * 4.0
					z_diff * 16.0
				));
				weight_total += weight;
				light_total += light * weight;
			}
		}
		light = light_total / weight_total;

		vec3 color = texelFetch(u_color, ivec2(coord0), 0).rgb;
		color = pow(color, vec3(2.2));
		vec3 e = emitting_light(color, block_light, emissive);
		if(depth0 == 1.0) {
			color = vec3(0.0);
			e = vec3(1.0);
		}

		vec3 dir_inc_cam = cam_dir_to_z1(gl_FragCoord.xy);
		vec3 normal_cam_transformed = compute_normal(
			dir_inc_cam, normal0, uvec2(gl_FragCoord.xy), roughness, 0
		);

		resulting_light = light_mix(
			dir_inc_cam, normal_cam_transformed,
			color, light, e,
			roughness, reflectance
		);
	}
	else if(frx_worldHasSkylight == 1) {
		vec3 wrld_dir = mat3(frx_inverseViewMatrix) * cam_dir_to_z1(gl_FragCoord.xy);
		resulting_light =
			sky(wrld_dir, 1.0);
	}

	vec3 begin = cam_near(gl_FragCoord.xy);
	vec3 end = depth0 == 1.0 ? begin + (pos0 - begin) * 10.0 : pos0;

	resulting_light = medium(resulting_light, begin, end, 1.0);

	out_prev_depth = texelFetch(u_depth, coord0, 0).r;

	vec3 taa = mix(resulting_light, prev_taa, taa_ratio);

	out_light = taa;

	out_taa = vec4(taa, taa_ratio);

	out_prev_light_1_accum = vec4(
		pow(light, vec3(1.0 / 2.2)),
		texelFetch(u_light_1_accum, coord0, 0).w
	);
}