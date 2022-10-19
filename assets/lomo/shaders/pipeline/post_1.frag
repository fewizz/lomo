#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/fog.glsl
#include frex:shaders/lib/math.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/sky.glsl
#include lomo:shaders/pipeline/post/traverser.glsl
#include lomo:shaders/pipeline/post/compute_normal.glsl
#include lomo:shaders/pipeline/post/shadow.glsl
#include lomo:shaders/pipeline/post/emitting_light.glsl
#include lomo:shaders/pipeline/post/ratio.glsl
#include lomo:shaders/pipeline/post/medium.glsl
#include lomo:shaders/pipeline/post/light_mix.glsl

#include lomo:general

/* lomo:pipeline/post_1.frag */

uniform sampler2D u_color;
uniform sampler2D u_normal;
uniform sampler2D u_extra_0;
uniform sampler2D u_extra_1;
uniform sampler2D u_depth;
uniform sampler2D u_reflection_position;

uniform sampler2D u_prev_light_1_accum;
uniform sampler2D u_taa;

uniform sampler2D u_prev_depth;

layout(location = 0) out vec4 out_light_1_accum;
layout(location = 1) out vec4 out_prev_taa;

void main() {
	out_prev_taa = texelFetch(u_taa, ivec2(gl_FragCoord.xy), 0);

	vec3 normal_cam_raw_0 = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	if(depth_0 == 1.0 || dot(normal_cam_raw_0, normal_cam_raw_0) < 0.9) {
		out_light_1_accum = vec4(0.0);
		return;
	}
	vec3 normal_cam_0 = normalize(normal_cam_raw_0);
	vec3 pos_win_0 = vec3(gl_FragCoord.xy, depth_0);
	vec3 dir_inc_cam_0 = cam_dir_to_z1(pos_win_0.xy);

	vec3 pos_cam_0 = win_to_cam(pos_win_0);

	dvec3 r_prev_pos_cam = dvec3(pos_cam_0);
	dvec3 r_prev_pos_wrd = cam_to_wrd(r_prev_pos_cam);
	r_prev_pos_wrd += dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos);

	r_prev_pos_cam = transform_pos(
		r_prev_pos_wrd, dmat4(frx_lastViewMatrix)
	);
	dvec3 r_prev_pos_ndc = transform_pos(
		r_prev_pos_cam, dmat4(frx_lastProjectionMatrix)
	);
	dvec3 r_prev_pos_win = ndc_to_win(r_prev_pos_ndc);

	float accum_ratio = texelFetch(u_prev_light_1_accum, ivec2(r_prev_pos_win.xy), 0).w;

	float prev_depth = texelFetch(u_prev_depth, ivec2(r_prev_pos_win.xy), 0).r;

	vec4 extras_0_0 = texelFetch(u_extra_0, ivec2(pos_win_0.xy), 0);
	vec4 extras_1_0 = texelFetch(u_extra_1, ivec2(pos_win_0.xy), 0);
	float roughness_0   =       extras_0_0[0];
	float sky_light_0   = clamp(extras_0_0[1], 0.0, 1.0);
	float block_light_0 = clamp(extras_0_0[2], 0.0, 1.0);
	float reflectance_0 =       extras_1_0[0];
	float emissive_0    =       extras_1_0[1];

	if(
		any(greaterThan(vec3(r_prev_pos_ndc), vec3( 1.0))) ||
		any(lessThan   (vec3(r_prev_pos_ndc), vec3(-1.0)))
	) {
		accum_ratio = 0.0;
	}
	else {
		double diff = abs(prev_depth - r_prev_pos_win.z);
		accum_ratio *= exp(-float(diff * 1024.0));

		vec3 prev_dir_inc_cam = cam_dir_to_z1(vec2(r_prev_pos_win.xy));
		prev_dir_inc_cam = mat3(frx_viewMatrix) * (inverse(mat3(frx_lastViewMatrix)) * prev_dir_inc_cam);

		accum_ratio *= exp(-(
			pow(
				length(cross(dir_inc_cam_0, prev_dir_inc_cam)),
				pow(roughness_0, 1.0) * 2.0
			) * mix(32.0, 0.0, roughness_0)
		));
	}

	vec3 color_0 = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	color_0 = pow(color_0, vec3(2.2));

	vec3 light_1 = vec3(0.0);

	if(
		#if REFLECTIONS == REFLECTIONS_ALL
		true
		#elif REFLECTIONS == REFLECTIONS_SHINY
		roughness < 0.5
		#elif REFLECTIONS == REFLECTIONS_WATER
		roughness == 0.0
		#elif REFLECTIONS == REFLECTIONS_NONE
		false
		#endif
	) {
		vec4 reflection_pos0 = texelFetch(u_reflection_position, ivec2(pos_win_0.xy), 0);
		vec3 reflection_pos = reflection_pos0.xyz;
		int code = int(reflection_pos0.w);

		vec3 normal_cam_transformed = compute_normal(
			dir_inc_cam_0, normal_cam_0, uvec2(gl_FragCoord.xy), roughness_0, 0
		);
		vec3 dir_out_cam_0 = reflect(dir_inc_cam_0, normal_cam_transformed);

		vec3 dir_out_cam = dir_out_cam_0;
		vec3 dir_inc_cam = dir_inc_cam_0;

		vec3 dir_inc_cam_1 = dir_out_cam_0;

		float roughness = roughness_0;
		float sky_light = sky_light_0;
		float reflectance = reflectance_0;
		float emissive = emissive_0;
		vec3 light = vec3(0.0);
		vec3 color = vec3(1.0);
		vec3 pos_cam = pos_cam_0;
		vec3 pos_win = pos_win_0;
		vec3 normal_cam = normal_cam_0;

		vec3 pos_cam_1 = reflection_pos;
		vec3 pos_win_1 = cam_to_win(pos_cam_1);
		vec3 normal_cam_raw_1 = texelFetch(u_normal, ivec2(pos_win_1), 0).xyz;
		float depth_1 = texelFetch(u_depth, ivec2(pos_win_1), 0).r;

		if(code == TRAVERSAL_POSSIBLY_UNDER) {
			float depth_at_result = texelFetch(u_depth, ivec2(pos_win_1.xy), 0).r;
			vec3 pos_cam_at = win_to_cam(vec3(pos_win_1.xy, depth_at_result));
			if(
				//abs(depth_at_result - result.pos.z) < 0.0005
				//distance(pos_cam_1, pos_cam_at) <= 1.0 / 8.0
				distance(pos_cam_1, pos_cam_at) <= 0.1 * -pos_cam_at.z
			) {
				code = TRAVERSAL_SUCCESS;
			}
		}

		bool pass =
			dot(normal_cam_raw_1, normal_cam_raw_1) > 0.9 &&
			code == TRAVERSAL_SUCCESS;

		vec3 normal_cam_transformed_1;
		float roughness_1;
		float reflectance_1;
		vec3 dir_out_cam_1;

		if(pass) {
			vec3 normal_cam_1 = normalize(normal_cam_raw_1);
			pos_win = pos_win_1;
			pos_cam = pos_cam_1;
			vec4 extra_0_1 = texelFetch(u_extra_0, ivec2(pos_win.xy), 0);
			vec4 extra_1_1 = texelFetch(u_extra_1, ivec2(pos_win.xy), 0);

			roughness_1       =       extra_0_1[0];
			roughness         =       roughness_1;
			sky_light         = clamp(extra_0_1[1], 0.0, 1.0);
			float block_light = clamp(extra_0_1[2], 0.0, 1.0);
			reflectance_1     =       extra_1_1[0];
			reflectance       =       reflectance_1;
			emissive          = clamp(extra_1_1[1], 0.0, 1.0);

			color = max(vec3(0.0), texelFetch(u_color, ivec2(pos_win.xy), 0).rgb);
			color = pow(color, vec3(2.2));
			light = emitting_light(color, block_light, emissive);

			normal_cam = normal_cam_1;

			normal_cam_transformed_1 = compute_normal(
				dir_inc_cam, normal_cam, uvec2(pos_win.xy), roughness, 0
			);
			normal_cam_transformed = normal_cam_transformed_1;
			dir_inc_cam = dir_out_cam;
			dir_out_cam_1 = reflect(dir_inc_cam, normal_cam_transformed);
			dir_out_cam = dir_out_cam_1;
		}

		vec3 s = vec3(0.0);

		if(frx_worldHasSkylight == 1) {
			float d = sun_light_at(pos_cam);
			bool straigth = !pass || pos_win.z >= 1.0;

			if(straigth) {
				s = sky(mat3(frx_inverseViewMatrix) * dir_out_cam, 1.0);
			}
			else {
				const uint steps = 12u;

				for(uint i = 0u; i < steps; ++i) {
					vec3 s0 = sky(mat3(frx_inverseViewMatrix) * dir_out_cam, 1.0);
					s += s0 / float(steps);
					normal_cam_transformed = compute_normal(
						dir_inc_cam, normal_cam, uvec2(pos_win.xy), roughness, i + 1
					);
					dir_out_cam = reflect(dir_inc_cam, normal_cam_transformed);
				}
			}
			if(pos_win.z < 1.0) {
				s *= pow(
					mix(max(sky_light - 0.1, 0.0) * 1.2, 0.0, emissive),
					mix(8.0, 0.0, d)
				);
			}
		}
		light_1 += s;

		if(pass) {
			light_1 = light_mix(
				dir_inc_cam_1, normal_cam_transformed_1,
				color, light_1, light,
				roughness_1, reflectance_1
			);
		}
	}

	vec3 prev_light_1 = texture(u_prev_light_1_accum, vec2(r_prev_pos_ndc.xy * 0.5 + 0.5)).rgb;
	prev_light_1 = max(prev_light_1, vec3(0.0));
	prev_light_1 = pow(prev_light_1, vec3(2.2));
	light_1 = mix(light_1, prev_light_1, accum_ratio);
	light_1 = pow(light_1, vec3(1.0 / 2.2));

	accum_ratio = increase_ratio(accum_ratio, 1024.0 * roughness_0);

	out_light_1_accum = vec4(light_1, accum_ratio);
}