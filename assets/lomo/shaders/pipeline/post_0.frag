#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/sky.glsl
#include lomo:shaders/pipeline/post/light_mix.glsl
#include lomo:shaders/pipeline/post/emitting_light.glsl
#include lomo:shaders/pipeline/post/ratio.glsl
#define MEDIUM_WITH_SUN
#include lomo:shaders/pipeline/post/medium.glsl
#include lomo:shaders/pipeline/post/compute_normal.glsl

/* lomo:pipeline/post_0.frag */

uniform sampler2D u_normal;
uniform sampler2D u_color;
uniform sampler2D u_depth;
uniform sampler2D u_extra_0;
uniform sampler2D u_extra_1;
uniform sampler2D u_light_1_accum;

uniform sampler2D u_vp_shadow;
uniform sampler2D u_ratio;

uniform samplerCube u_sky_w_sun;

layout(location = 0) out float out_prev_depth;
layout(location = 1) out vec3 out_prev_normal;
layout(location = 2) out float out_prev_vp_shadow;
layout(location = 3) out float out_prev_ratio;
layout(location = 4) out vec3 out_light;

void main() {
	ivec2 coord_0 = ivec2(gl_FragCoord.xy);
	out_prev_depth = texelFetch(u_depth, coord_0, 0).r;
	out_prev_normal = texelFetch(u_normal, coord_0, 0).xyz;
	out_prev_vp_shadow = texelFetch(u_vp_shadow, coord_0, 0).r;
	out_prev_ratio = texelFetch(u_ratio, coord_0, 0).r;

	float depth = texelFetch(u_depth, ivec2(coord_0), 0).r;
	vec3 normal_cam = texelFetch(u_normal, ivec2(coord_0), 0).xyz;
	vec3 pos_cam = win_to_cam(vec3(gl_FragCoord.xy, depth));
	vec3 dir_inc_cam = cam_dir_to_z1(gl_FragCoord.xy);

	vec3 r_prev_pos_cam = pos_cam;
	vec3 r_prev_pos_wrd = cam_to_wrd(r_prev_pos_cam);
	r_prev_pos_wrd += frx_cameraPos - frx_lastCameraPos;
	r_prev_pos_cam = transform_pos(
		r_prev_pos_wrd, frx_lastViewMatrix
	);
	vec3 r_prev_pos_ndc = transform_pos(
		r_prev_pos_cam, frx_lastProjectionMatrix
	);
	vec3 r_prev_pos_win = ndc_to_win(r_prev_pos_ndc);

	vec3 resulting_light = vec3(0.0);
	float sky_light = 0.0;

	if(dot(normal_cam, normal_cam) < 0.5 && depth != 1.0) {
		resulting_light = vec3(0.0);
	}
	else if(depth < 1.0) {
		vec3 extras_0 = texelFetch(u_extra_0, ivec2(coord_0), 0).rgb;
		float roughness = clamp(extras_0[0], 0.0, 1.0);
		sky_light       = clamp(extras_0[1], 0.0, 1.0);
		float block_light = clamp(extras_0[2], 0.0, 1.0);

		vec3 extras_1 = texelFetch(u_extra_1, ivec2(coord_0), 0).rgb;
		float reflectance = extras_1[0];
		float emissive    = extras_1[1];

		vec3 light_total = vec3(0.0);
		float weight_total = 0.0;
		vec3 light = texelFetch(u_light_1_accum, ivec2(coord_0), 0).rgb;
		vec3 color = texelFetch(u_color, ivec2(coord_0), 0).rgb;

		color = pow(color, vec3(2.2));

		vec3 e = emitting_light(color, block_light, emissive);
		if(depth == 1.0) {
			color = vec3(0.0);
			e = vec3(1.0);
		}

		resulting_light = light_mix(
			dir_inc_cam, normal_cam,
			color, light, e,
			roughness, reflectance
		);
	}
	else if(frx_worldHasSkylight == 1) {
		vec3 wrld_dir = mat3(frx_inverseViewMatrix) * dir_inc_cam;
		resulting_light = sky(wrld_dir, 1.0);
		sky_light = 1.0;
	}
	else if(frx_worldIsEnd == 1) {
		vec3 wrld_dir = mat3(frx_inverseViewMatrix) * dir_inc_cam;
		resulting_light = end_sky(wrld_dir);
		sky_light = 1.0;
	}

	vec3 pos_cam_begin = cam_near(gl_FragCoord.xy);
	vec3 pos_cam_end = pos_cam;
	resulting_light = medium(resulting_light, pos_cam_begin, pos_cam_end, dir_inc_cam, sky_light, u_sky_w_sun);

	out_light = resulting_light;
}