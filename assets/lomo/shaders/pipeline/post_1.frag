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

/* lomo:pipeline/post_0.frag */

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
layout(location = 1) out vec3 out_color_accum;

layout(location = 2) out float out_light_1_accum_counter;
layout(location = 3) out float out_color_accum_counter;

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

	uint color_accum_count =
		floatBitsToUint(texelFetch(u_prev_color_accum_counter, ivec2(r_prev_pos_win.xy), 0).r);

	float prev_depth = texelFetch(u_prev_depth, ivec2(r_prev_pos_win.xy), 0).r;

	if(
		any(greaterThan(vec3(r_prev_pos_ndc), vec3( 1.0))) ||
		any(lessThan   (vec3(r_prev_pos_ndc), vec3(-1.0)))
	) {
		accum_count = 0u;
		color_accum_count = 0u;
	}

	if(abs(prev_depth - r_prev_pos_win.z) > 0.0004) {
		accum_count = 0u;
	}

	color_accum_count += 1u;
	color_accum_count = min(color_accum_count, 1u);

	vec3 color_0 = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	color_0 = pow(color_0, vec3(2.2));

	vec3 prev_color = // TODO TAA
		texture(u_prev_color_accum, vec2(r_prev_pos_ndc.xy * 0.5 + 0.5)).rgb;
	prev_color = max(vec3(0.0), prev_color);
	out_color_accum = mix(prev_color, color_0, 1.0 / float(color_accum_count));
	out_color_accum_counter = uintBitsToFloat(color_accum_count);

	vec3 geometric_normal_cam = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	if(initial_depth == 1.0 || dot(geometric_normal_cam, geometric_normal_cam) < 0.9) {
		out_light_1_accum = vec3(0.0);
		out_light_1_accum_counter = uintBitsToFloat(0u);
		return;
	}

	vec3 pos_cam = pos_cam0;

	vec3 color = vec3(1.0);
	vec3 light = vec3(0.0);
	
	vec4 extra_0_0 = texelFetch(u_extra_0, ivec2(pos.texel), 0);
	float roughness = extra_0_0[0];
	float roughness_0 = roughness;
	float sky_light = extra_0_0[1];

	geometric_normal_cam = normalize(geometric_normal_cam);
	vec3 dir_cam = cam_dir_to_z1(gl_FragCoord.xy);
	vec3 normal_cam = compute_normal(
		dir_cam, geometric_normal_cam, pos.texel, roughness
	);
	dir_cam = normalize(reflect(dir_cam, normal_cam));

	if(dot(dir_cam, geometric_normal_cam) > 0.0) {
		pos.z -= 0.00001;

		fb_traversal_result result = traverse_fb(
			pos, cam_dir_to_win(pos_cam, dir_cam),
			cam_dir_to_ndc(pos_cam, dir_cam),
			u_hi_depth, u_depth, u_win_normal,
			uint(mix(40, 80, (1.0 - roughness)))
		);

		vec3 geometric_normal_cam0 = texelFetch(u_normal, ivec2(result.pos.texel), 0).xyz;

		if(dot(geometric_normal_cam0, geometric_normal_cam0) > 0.9 && result.code == TRAVERSAL_SUCCESS) {
			pos = result.pos;
			vec4 extra_0_1 = texelFetch(u_extra_0, ivec2(pos.texel), 0);

			roughness = extra_0_1[0];
			sky_light = extra_0_1[1];
			float block_light_1 = extra_0_1[2];

			color = texelFetch(u_color, ivec2(pos.texel), 0).rgb;
			color = pow(color, vec3(2.2));
			light = color * block_light_1;
			pos_cam = win_to_cam(vec3(ivec2(pos.texel) + pos.inner, pos.z));
			geometric_normal_cam = geometric_normal_cam0;
			geometric_normal_cam = normalize(geometric_normal_cam);
			normal_cam = compute_normal(
				dir_cam, geometric_normal_cam, pos.texel, roughness
			);
			dir_cam = normalize(reflect(dir_cam, normal_cam));
		}
	}

	vec3 s = vec3(0.0);
	if(frx_worldHasSkylight == 1) {
		s = sky(mat3(frx_inverseViewMatrix) * dir_cam, roughness < 0.1);
		vec3 sd = sun_dir();
		float d = sun_light_at(pos_cam);
		float dt = dot(
			sd,
			mat3(frx_inverseViewMatrix) *
			mix(normal_cam, geometric_normal_cam, 0.0) // still can't decide
		);
		dt = max(dt, 0.0);
		vec3 sun = 0.05 * d * dt * roughness * sky(sd, true) * float(sd.y > 0.0);
		s = max(s, sun);
		s *= pow(sky_light, 4.0);
	}

	vec3 light_1 = color * s + light;

	accum_count += 1u;
	accum_count = min(accum_count, max(1u, uint(32.0 * pow(roughness_0, 2.0))));

	vec3 prev_light_1 =
		texture(u_prev_light_1_accum, vec2(r_prev_pos_ndc.xy * 0.5 + 0.5)).rgb;
	prev_light_1 = max(vec3(0.0), prev_light_1);
	out_light_1_accum = mix(prev_light_1, light_1, 1.0 / float(accum_count));
	out_light_1_accum_counter = uintBitsToFloat(accum_count);
}