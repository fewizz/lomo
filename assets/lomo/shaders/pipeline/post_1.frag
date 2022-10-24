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

uniform sampler2D u_prev_depth;

layout(location = 0) out vec3 out_post_1;

void main() {
	vec3 normal_cam_raw_0 = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	if(depth_0 == 1.0 || dot(normal_cam_raw_0, normal_cam_raw_0) < 0.9) {
		out_post_1 = vec3(0.0);
		return;
	}
	vec3 normal_cam_0 = normalize(normal_cam_raw_0);
	vec3 pos_win_0 = vec3(gl_FragCoord.xy, depth_0);
	vec3 dir_inc_cam_0 = cam_dir_to_z1(pos_win_0.xy);

	vec3 pos_cam_0 = win_to_cam(pos_win_0);

	vec4 extras_0_0 = texelFetch(u_extra_0, ivec2(pos_win_0.xy), 0);
	vec4 extras_1_0 = texelFetch(u_extra_1, ivec2(pos_win_0.xy), 0);
	float roughness_0   = extras_0_0[0];
	float sky_light_0   = extras_0_0[1];
	float block_light_0 = extras_0_0[2];
	float reflectance_0 = extras_1_0[0];
	float emissive_0    = extras_1_0[1];

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

		bool pass = dot(normal_cam_raw_1, normal_cam_raw_1) > 0.9 && code == TRAVERSAL_SUCCESS;

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

			roughness_1       = extra_0_1[0];
			roughness         = roughness_1;
			sky_light         = extra_0_1[1];
			float block_light = extra_0_1[2];
			reflectance_1     = extra_1_1[0];
			reflectance       = reflectance_1;
			emissive          = extra_1_1[1];

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
			float d_0 = sun_light_at(pos_cam_0);
			bool straigth = !pass || pos_win.z >= 1.0;

			if(straigth) {
				s = sky(mat3(frx_inverseViewMatrix) * dir_out_cam, code == TRAVERSAL_POSSIBLY_UNDER ? d : 1.0);
			}
			else {
				const uint steps = 8u;

				for(uint i = 0u; i < steps; ++i) {
					vec3 s0 = sky(mat3(frx_inverseViewMatrix) * dir_out_cam, 1.0);
					s += s0 / float(steps);
					normal_cam_transformed = compute_normal(
						dir_inc_cam, normal_cam, uvec2(pos_win.xy), roughness, i + 1
					);
					dir_out_cam = reflect(dir_inc_cam, normal_cam_transformed);
				}
			}
			if(pos_win_1.z < 1.0) {
				s *= /*light_mix(
					dir_inc_cam_0, normal_cam_0,
					color_0, s * d_0, vec3(0.0),
					roughness_0, reflectance_0
				);*/
				//d;
				pow(
					mix(max(sky_light - 0.1, 0.0) * 1.2, 0.0, emissive),
					mix(16.0, 0.0, d)
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

		vec3 pos_cam_begin = pos_cam_0;
		vec3 pos_cam_end = pos_cam_1;

		light_1 = medium(
			light_1, pos_cam_begin, pos_cam_end, dir_out_cam_0, 1.0
		);
	}

	out_post_1 = pow(light_1, vec3(1.0 / 2.2));
}