#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/fog.glsl
#include frex:shaders/lib/math.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/ray_plane.glsl
#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/lib/traverser.glsl

#include lomo:shaders/pipeline/post/sky.glsl
#include lomo:shaders/pipeline/post/compute_normal.glsl
#include lomo:shaders/pipeline/post/shadow.glsl
#include lomo:shaders/pipeline/post/emitting_light.glsl

#include lomo:general

/* lomo:pipeline/post_1.frag */

uniform sampler2D u_color;
uniform sampler2D u_normal;
uniform sampler2D u_extra_0;
uniform sampler2D u_extra_1;
uniform sampler2D u_depth;
uniform sampler2D u_win_normal;
uniform sampler2D u_hi_depth;

uniform sampler2D u_prev_light_1_accum;
uniform sampler2D u_prev_light_1_accum_counter;

uniform sampler2D u_prev_color_accum;
uniform sampler2D u_prev_color_accum_counter;

uniform sampler2D u_prev_depth;

layout(location = 0) out vec3 out_light_1_accum;
layout(location = 1) out vec4 out_color_accum;

layout(location = 2) out float out_light_1_accum_counter;
layout(location = 3) out float out_color_accum_counter;

layout(location = 4) out vec3 out_light_1_pos;

struct light_info {
	vec3 light;
	vec3 color;
	vec3 pos_cam;
	float roughness;
};

void main() {
	float initial_depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	fb_pos pos = fb_pos(uvec2(gl_FragCoord.xy), vec2(0.5), initial_depth);
	vec3 pos_cam0 = win_to_cam(vec3(gl_FragCoord.xy, initial_depth));

	dvec3 r_prev_pos_cam = dvec3(pos_cam0);
	dvec3 r_prev_pos_wrd = cam_to_wrd(r_prev_pos_cam);
	r_prev_pos_wrd += dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos);

	r_prev_pos_cam = transform_pos(
		r_prev_pos_wrd, dmat4(frx_lastViewMatrix)
	);
	dvec3 r_prev_pos_ndc = transform_pos(
		r_prev_pos_cam, dmat4(frx_lastProjectionMatrix)
	);
	dvec3 r_prev_pos_win = ndc_to_win(r_prev_pos_ndc);

	uint accum_count =
		floatBitsToUint(texelFetch(u_prev_light_1_accum_counter, ivec2(r_prev_pos_win.xy), 0).r);

	float prev_shadow = texelFetch(u_prev_color_accum_counter, ivec2(r_prev_pos_win.xy), 0).r;

	float prev_depth = texelFetch(u_prev_depth, ivec2(r_prev_pos_win.xy), 0).r;

	if(
		any(greaterThan(vec3(r_prev_pos_ndc), vec3( 1.0))) ||
		any(lessThan   (vec3(r_prev_pos_ndc), vec3(-1.0)))
	) {
		accum_count = 0u;
	}

	{
		double diff = abs(prev_depth - r_prev_pos_win.z);
		if(diff > 0.0004) {
			accum_count = 0u;
		}
	}

	float shadow0 = sun_light_at(pos_cam0);
	out_color_accum_counter = shadow0;//uintBitsToFloat(color_accum_count);
	float shadow_diff = abs(
		shadow0 -
		prev_shadow
	);

	accum_count = uint(float(accum_count) * exp(-shadow_diff * 3.0));

	vec3 color_0 = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	color_0 = pow(color_0, vec3(2.2));

	vec3 prev_color = // TODO TAA
		texture(u_prev_color_accum, vec2(r_prev_pos_ndc.xy * 0.5 + 0.5)).rgb;
	prev_color = max(vec3(0.0), prev_color);

	vec3 geometric_normal_cam = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	if(initial_depth == 1.0 || dot(geometric_normal_cam, geometric_normal_cam) < 0.9) {
		out_light_1_accum = vec3(0.0);
		//out_color_accum = vec4(0.0);
		out_light_1_accum_counter = uintBitsToFloat(1u);
		out_color_accum_counter = 0.0;
		return;
	}

	vec3 pos_cam = pos_cam0;

	vec3 color = vec3(1.0);
	vec3 light = vec3(0.0);
	
	vec4 extra_0_0 = texelFetch(u_extra_0, ivec2(pos.texel), 0);
	vec4 extra_1_0 = texelFetch(u_extra_1, ivec2(pos.texel), 0);
	float roughness_0   =       extra_0_0[0];
	float sky_light_0   = clamp(extra_0_0[1], 0.0, 1.0);
	float block_light_0 = clamp(extra_0_0[2], 0.0, 1.0);
	float reflectance_0 =       extra_1_0[0];
	float emissive_0    =       extra_1_0[1];

	float roughness   = roughness_0;
	float sky_light   = sky_light_0;
	float block_light = block_light_0;
	float reflectance = reflectance_0;
	float emissive    = emissive_0;

	geometric_normal_cam = normalize(geometric_normal_cam);
	vec3 dir_cam0 = cam_dir_to_z1(gl_FragCoord.xy);
	vec3 dir_cam = dir_cam0;
	vec3 normal_cam = compute_normal(
		dir_cam, geometric_normal_cam, pos.texel, roughness, 0u
	);
	dir_cam = normalize(reflect(dir_cam, normal_cam));
	int traversal_result_code = TRAVERSAL_OUT_OF_FB;

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
		&&
		dot(dir_cam, geometric_normal_cam) > 0.0
	) {
		pos.z -= 0.00001;
		uint max_side = uint(max(frxu_size.x, frxu_size.y));
		fb_traversal_result result = traverse_fb(
			pos, cam_dir_to_win(pos_cam, dir_cam),
			cam_dir_to_ndc(pos_cam, dir_cam),
			u_hi_depth, u_depth, u_win_normal,
			uint(mix(max_side / 50, max_side / 25, (1.0 - roughness)))
		);
		traversal_result_code = result.code;

		vec3 geometric_normal_cam0 = texelFetch(u_normal, ivec2(result.pos.texel), 0).xyz;

		if(dot(geometric_normal_cam0, geometric_normal_cam0) > 0.9 && result.code == TRAVERSAL_SUCCESS) {
			pos = result.pos;
			pos_cam = win_to_cam(vec3(ivec2(pos.texel) + pos.inner, pos.z));
			vec4 extra_0_1 = texelFetch(u_extra_0, ivec2(pos.texel), 0);
			vec4 extra_1_1 = texelFetch(u_extra_1, ivec2(pos.texel), 0);

			roughness   =       extra_0_1[0];
			sky_light   = clamp(extra_0_1[1], 0.0, 1.0);
			block_light = clamp(extra_0_1[2], 0.0, 1.0);
			reflectance =       extra_1_1[0];
			emissive    =       extra_1_1[1];

			color = max(vec3(0.0), texelFetch(u_color, ivec2(pos.texel), 0).rgb);
			color = pow(color, vec3(2.2));
			light = emitting_light(color, block_light, emissive);
			//out_light_1_pos = pos_cam;
			geometric_normal_cam = geometric_normal_cam0;
			geometric_normal_cam = normalize(geometric_normal_cam);
			//normal_cam = compute_normal(
			//	dir_cam, geometric_normal_cam, pos.texel, roughness
			//);
			//dir_cam = normalize(reflect(dir_cam, normal_cam));
		}
	}

	vec3 s = vec3(0.0);

	if(frx_worldHasSkylight == 1) {
		vec3 sd = sun_dir();
		float d = sun_light_at(pos_cam);
		vec3 sun = 0.15 * d * sky(sd, true) * float(sd.y > 0.0);

		for(uint i = 0u; i < 8u; ++i) {
			vec3 s0 = vec3(0.0);
			normal_cam = compute_normal(
				dir_cam, geometric_normal_cam, pos.texel, roughness, i + 1
			);
			dir_cam = normalize(reflect(dir_cam, normal_cam));
			s0 = sky(mat3(frx_inverseViewMatrix) * dir_cam, roughness < 0.3);
			float dt = dot(
				sd,
				mat3(frx_inverseViewMatrix) *
				mix(normal_cam, geometric_normal_cam, 0.0) // still can't decide
			);
			dt = max(dt, 0.0);
			vec3 sun0 = sun * dt;
			float f = max(0.0, dot(sd, mat3(frx_inverseViewMatrix) * dir_cam));
			sun0 *= pow(abs(f) / PI, 1.0 / (2.0 * roughness + 0.000005) + 0.5);
			s0 = max(s0, sun0);
			s += s0 / 8.0;
		}

		s *= pow(mix(sky_light, 0.0, clamp(emissive, 0.0, 1.0)), mix(4.0, 0.0, d));
	}
	vec3 light_1 = color * s + light;

	accum_count += 1u;
	accum_count = min(accum_count, max(1u, uint(16.0 * pow(roughness_0, 1.5))));

	vec3 prev_light_1 =
		texture(u_prev_light_1_accum, vec2(r_prev_pos_ndc.xy * 0.5 + 0.5)).rgb;
	prev_light_1 = max(vec3(0.0), prev_light_1);
	out_light_1_accum = mix(prev_light_1, light_1, 1.0 / float(accum_count));
	out_light_1_accum_counter = uintBitsToFloat(accum_count);
}