#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/fog.glsl
#include frex:shaders/lib/math.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/sky.glsl
#include lomo:shaders/pipeline/post/traverser.glsl
#include lomo:shaders/pipeline/post/compute_normal.glsl
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
uniform samplerCube u_sky_w_sun;
uniform samplerCube u_sky_wo_sun;
uniform sampler2D u_prev_depth;
uniform sampler2D u_vp_shadow;

layout(location = 0) out vec3 out_post_1;

void main() {
	vec3 normal_cam_raw_0 = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	bool valid_normal_0 = dot(normal_cam_raw_0, normal_cam_raw_0) > 0.9;
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	if(depth_0 == 1.0 || !valid_normal_0) {
		out_post_1 = vec3(0.0);
		return;
	}
	vec3 normal_cam_0 = normalize(normal_cam_raw_0);
	vec3 pos_win_0 = vec3(gl_FragCoord.xy, depth_0);
	vec3 dir_inc_cam_0 = cam_dir_to_z1(pos_win_0.xy);

	vec3 pos_cam_0 = win_to_cam(pos_win_0);

	vec4 extras_0_0 = texelFetch(u_extra_0, ivec2(pos_win_0.xy), 0);
	vec4 extras_1_0 = texelFetch(u_extra_1, ivec2(pos_win_0.xy), 0);
	float roughness_0   = clamp(extras_0_0[0], 0.0, 1.0);
	float sky_light_0   = clamp(extras_0_0[1], 0.0, 1.0);
	float block_light_0 = clamp(extras_0_0[2], 0.0, 1.0);
	float reflectance_0 = clamp(extras_1_0[0], 0.0, 1.0);
	float emissive_0    = extras_1_0[1];

	vec3 color_0 = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	color_0 = pow(color_0, vec3(2.2));

	vec3 light_1 = vec3(0.0);

	const int samples = 1;
	for(int smpl = 0; smpl < samples; ++smpl) {

	vec3 normal_cam_transformed = compute_normal(
		dir_inc_cam_0, normal_cam_0, uvec2(gl_FragCoord.xy), roughness_0, smpl * 1024
	);
	vec3 dir_out_cam_0 = reflect(dir_inc_cam_0, normal_cam_transformed);

	fb_traversal_result result; {
		vec3 dir_ws = cam_dir_to_win(pos_cam_0, dir_out_cam_0);
		float z_offset = max(0.0, dir_ws.z * 2.5);

		vec3 pos_win_traverse_beginning = pos_win_0;
		pos_win_traverse_beginning.z -= z_offset;
		pos_win_traverse_beginning.z -= 1.0 / 1000000.0;

		uint max_side = uint(max(frxu_size.x, frxu_size.y));
		result = traverse_fb(
			pos_win_traverse_beginning, dir_ws,
			u_hi_depth,
			128
		);
	}

	vec3 reflection_pos = win_to_cam(
		vec3(result.texel + vec2(0.5), result.z)
	);
	ivec2 reflection_pos_win = ivec2(result.texel);
	bool success = result.success;

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

	pos_cam_1 = win_to_cam(vec3(
		pos_win_1.xy,
		texelFetch(u_depth, ivec2(pos_win_1.xy), 0).r
	));

	bool valid_normal_1 = dot(normal_cam_raw_1, normal_cam_raw_1) > 0.9;
	bool pass = success && valid_normal_1;

	vec3 normal_cam_transformed_1;
	float roughness_1;
	float reflectance_1;
	vec3 dir_out_cam_1;
	vec3 dir_out_cam_straigt = dir_out_cam_0;

	if(pass) {
		vec3 normal_cam_1 = normalize(normal_cam_raw_1);
		pos_win = pos_win_1;
		pos_cam = pos_cam_1;
		vec4 extra_0_1 = texelFetch(u_extra_0, ivec2(pos_win.xy), 0);
		vec4 extra_1_1 = texelFetch(u_extra_1, ivec2(pos_win.xy), 0);

		roughness_1       = clamp(extra_0_1[0], 0.0, 1.0);
		roughness         = roughness_1;
		sky_light         = clamp(extra_0_1[1], 0.0, 1.0);
		float block_light = clamp(extra_0_1[2], 0.0, 1.0);
		reflectance_1     = clamp(extra_1_1[0], 0.0, 1.0);
		emissive          = extra_1_1[1];

		reflectance       = reflectance_1;

		color = max(vec3(0.0), texelFetch(u_color, ivec2(pos_win.xy), 0).rgb);
		color = pow(color, vec3(2.2));
		light = emitting_light(color, block_light, emissive);

		normal_cam = normal_cam_1;

		normal_cam_transformed_1 = compute_normal(
			dir_inc_cam, normal_cam, uvec2(pos_win.xy), roughness, smpl
		);
		normal_cam_transformed = normal_cam_transformed_1;
		dir_inc_cam = dir_out_cam;
		dir_out_cam_1 = reflect(dir_inc_cam, normal_cam_transformed);
		dir_out_cam = dir_out_cam_1;
		dir_out_cam_straigt = reflect(dir_out_cam_0, normal_cam_1);
	}

	vec3 s = vec3(0.0);

	if(frx_worldHasSkylight == 1) {
		float lod = pow(max(roughness, roughness_0), 0.2) * 7.0;

		bool hit_z_1 = pass && result.z >= 1.0;
		vec3 sky_dir = dir_out_cam;//hit_z_1 ? dir_out_cam : dir_out_cam;
		sky_dir = mat3(frx_inverseViewMatrix) * sky_dir;

		vec3 sky_w_sun  = textureLod(u_sky_w_sun,  sky_dir, lod).rgb;
		vec3 sky_wo_sun = textureLod(u_sky_wo_sun, sky_dir, lod).rgb;

		float d = texelFetch(u_vp_shadow, ivec2(pos_win.xy), 0).r;//sun_light_at(pos_cam);
		//d = 1.0;
		if(dot(sun_dir(), mat3(frx_inverseViewMatrix) * normal_cam) < 0.0) {
			d = 0.0;
		}

		s = mix(sky_wo_sun, sky_w_sun, hit_z_1 ? 1.0 : d);

		sphere sph = sphere(vec3(0.0, 0.0, -frx_viewDistance * 0.9), frx_viewDistance);
		ray r = ray(pos_cam, dir_out_cam);

		ray_sphere_intersection_result res = ray_sphere_intersection(r, sph);

		s = medium(
			s, pos_cam, pos_cam + dir_out_cam * max(0.0, res.close), dir_out_cam, 1.0
		);

		if(!hit_z_1) {
			s *= pow(
				max(sky_light - 0.1, 0.0) * 1.2,
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
	light_1 /= float(samples);

	out_post_1 = pow(light_1, vec3(1.0 / 2.2));
}