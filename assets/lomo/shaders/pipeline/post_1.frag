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
uniform sampler2D u_hi_depth;

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

	vec3 dir_wss[4];
	vec3 dir_out_cams_0[4];
	vec3 normal_cams_transformed[4];
	float z_offset = 0.0;

	for(int i = 0; i < 4; ++i) {
		normal_cams_transformed[i] = compute_normal(
			dir_inc_cam_0, normal_cam_0, uvec2(gl_FragCoord.xy), roughness_0, i
		);
		dir_out_cams_0[i] = reflect(dir_inc_cam_0, normal_cams_transformed[i]);

		dir_wss[i] = cam_dir_to_win(pos_cam_0, dir_out_cams_0[i]);
		z_offset = max(z_offset, dir_wss[i].z);
	}

	vec3 pos_win_traverse_beginning = pos_win_0;
	pos_win_traverse_beginning.z -= z_offset;
	pos_win_traverse_beginning.z -= 1.0 / 1000000.0;
	int tries;

	uint max_side = uint(max(frxu_size.x, frxu_size.y));
	fb_traversal_results results = traverse_fb(
		pos_win_traverse_beginning, dir_wss,
		u_hi_depth,
		uint(64),
		tries
	);

	for(int try = 0; try < max(tries, 1); ++try) {

	fb_traversal_result result = results.result[try];
	vec3 dir_out_cam_0 = dir_out_cams_0[try];
	vec3 normal_cam_transformed = normal_cams_transformed[try];

	vec3 reflection_pos = win_to_cam(
		vec3(fb_traversal_result_texel(result) + vec2(0.5), result.z)
	);
	ivec2 reflection_pos_win = ivec2(fb_traversal_result_texel(result));
	bool success = fb_traversal_result_is_success(result);

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
	vec3 pos_win_1 = vec3(reflection_pos_win + vec2(0.5), result.z);
	vec3 normal_cam_raw_1 = texelFetch(u_normal, ivec2(pos_win_1), 0).xyz;
	float depth_1 = texelFetch(u_depth, ivec2(pos_win_1), 0).r;

	if(success) {
		float depth_at_result = texelFetch(u_depth, ivec2(pos_win_1.xy), 0).r;
		vec3 pos_cam_at = win_to_cam(vec3(pos_win_1.xy, depth_at_result));
		float delta = distance(pos_cam_1, pos_cam_at);
		if(delta > -pos_cam_at.z / 4.0) {
			success = false;
		}
	}

	bool pass = success && dot(normal_cam_raw_1, normal_cam_raw_1) > 0.9;

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
		emissive          = extra_1_1[1];

		reflectance       = reflectance_1;

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
		bool straigth = false;//pass && result.z >= 1.0;

		if(straigth) {
			s = sky(
				mat3(frx_inverseViewMatrix) * dir_out_cam,
				pos_win.z >= 1.0 ? 1.0 : d
			);
		}
		else {
			const uint steps = 16u;
			vec3 normal_av = vec3(0.0);

			for(uint i = 0u; i < steps; ++i) {
				vec3 s0 = sky(mat3(frx_inverseViewMatrix) * dir_out_cam, d);
				s += s0 / float(steps);
				normal_cam_transformed = compute_normal(
					dir_inc_cam, normal_cam, uvec2(pos_win.xy), roughness, (try + 234912) * 1024 + i * 4096 + 1
				);
				normal_av += normal_cam_transformed;
				dir_out_cam = reflect(dir_inc_cam, normal_cam_transformed);
			}
			normal_av = normalize(normal_av);
			dir_out_cam = reflect(dir_inc_cam, normal_av);
		}

		sphere sph = sphere(vec3(0.0, -frx_viewDistance * 0.9, 0.0), frx_viewDistance);
		ray r = ray(pos_cam, dir_out_cam);

		ray_sphere_intersection_result res = ray_sphere_intersection(r, sph);

		s = medium(
			s, pos_cam, pos_cam + dir_out_cam * max(0.0, res.close), dir_out_cam, 1.0
		);
		if(!(pass && result.z >= 1.0)) {
			s *= pow(
				mix(max(sky_light - 0.1, 0.0) * 1.2, 0.0, emissive),
				mix(12.0, 0.0, d)
			);
		}
	}
	else if(frx_worldIsEnd == 1) {
		s = end_sky(mat3(frx_inverseViewMatrix) * dir_out_cam);
	}
	vec3 l = s;

	if(pass) {
		l = light_mix(
			dir_inc_cam_1, normal_cam_transformed_1,
			color, l, light,
			roughness_1, reflectance_1
		);

		vec3 pos_cam_begin = pos_cam_0;
		vec3 pos_cam_end = pos_cam_1;

		l = medium(
			l, pos_cam_begin, pos_cam_end, dir_out_cam_0, sky_light_0
		);
	}

	light_1 += l;

	}

	light_1 /= tries > 0 ? float(tries) : 1.0;

	out_post_1 = pow(light_1, vec3(1.0 / 2.2));
}