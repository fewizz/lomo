#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/sky.glsl
#include lomo:shaders/lib/blend.glsl
#include lomo:shaders/lib/ray_plane.glsl
#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/lib/traverser.glsl

/* lomo:post.frag */

uniform sampler2D u_colors;
uniform sampler2D u_normals;
uniform sampler2D u_extras_0;
uniform sampler2D u_extras_1;
uniform sampler2D u_depths;
uniform sampler2D u_win_normals;
uniform sampler2D u_hi_depths;
uniform sampler2D u_accum_0;
uniform sampler2DArrayShadow u_shadow_map;

layout(location = 0) out vec4 out_color;

// from dev pipeline
vec3 shadow_dist(int cascade, vec3 shadow_pos) {
	vec4 c = frx_shadowCenter(cascade);
	return abs((c.xyz - shadow_pos.xyz) / c.w);
}

int select_shadow_cascade(vec3 shadow_pos) {
	vec3 d3 = shadow_dist(3, shadow_pos);
	vec3 d2 = shadow_dist(2, shadow_pos);
	vec3 d1 = shadow_dist(1, shadow_pos);

	if (all(lessThan(d3, vec3(1.0)))) return 3;
	if (all(lessThan(d2, vec3(1.0)))) return 2;
	if (all(lessThan(d1, vec3(1.0)))) return 1;

	return 0;
}

vec3 compute_normal(vec3 incidence, vec3 geometric_normal, vec2 pos_win_xy, float roughness) {
	float r = roughness * 3.1416 / 2.0;
	vec2 rand = hash23(uvec3(frx_renderSeconds * 1000.0, pos_win_xy));

	if(dot(-incidence, geometric_normal) < 0) geometric_normal *= -1;

	float x = (rand.x * 2.0 - 1.0) * r;

	vec3 new_normal = rotation(
		x,
		normalize(cross(-incidence, geometric_normal))
	) * geometric_normal;

	float cosa = dot(-incidence, geometric_normal);
	float angle = acos(cosa);
	float max_angle = 3.1416 / 2.0 - angle;

	float g = min(r, max_angle);
	if(x > g)
		cosa = g / x;
	else
		cosa = 1.0;
		
	max_angle = acos(cosa);
	float y = max_angle + (3.1416 - max_angle) * (rand.y * 2.0);

	return rotation(y, geometric_normal) * new_normal;
}

float fix_light_value(float v) {
	return max(v - 0.03, 0.0) / (0.9 - 0.03);
}

float sun_light_at_shadow_pos(vec3 pos) {
	int cascade = select_shadow_cascade(pos);

	vec4 shadow_pos_proj = frx_shadowProjectionMatrix(cascade) * vec4(pos, 1.0);
	shadow_pos_proj.xyz /= shadow_pos_proj.w;

	vec3 shadow_tex = shadow_pos_proj.xyz * 0.5 + 0.5;
	return texture(u_shadow_map, vec4(shadow_tex.xy, cascade, shadow_tex.z));
}

float sun_light_at_world_pos(vec3 pos) {
	vec4 shadow_pos_cam = frx_shadowViewMatrix * vec4(pos, 1.0);
	return sun_light_at_shadow_pos(shadow_pos_cam.xyz / shadow_pos_cam.w);
}

float sun_light_at(vec3 pos) {
	vec4 world = frx_inverseViewMatrix * vec4(pos, 1.0);
	return sun_light_at_world_pos(world.xyz / world.w);
}

void main() {
	const int steps = 2;
	const int max_step_index = steps - 1;
	vec3 lights[steps];
	vec3 sky_lights[steps];
	vec3 colors[steps];

	for(int i = 0; i < steps; ++i) {
		lights[i] = vec3(0.0);
		sky_lights[i] = vec3(0.0);
		colors[i] = vec3(0.0);
	}

	fb_pos pos = fb_pos(
		uvec2(gl_FragCoord.xy),
		vec2(0.5),
		0.0
	);

	vec3 pos_cam = cam_near(gl_FragCoord.xy);
	vec3 dir_cam = cam_dir_to_z1(gl_FragCoord.xy);

	float initial_depth = texelFetch(u_depths, ivec2(gl_FragCoord.xy), 0).r;

	vec3 sun_light = vec3(0.0);

	if(frx_worldIsOverworld == 1) {
		vec4 begin_sh0 = frx_shadowViewMatrix * frx_inverseViewMatrix * vec4(pos_cam, 1.0);
		vec3 begin_sh = begin_sh0.xyz / begin_sh0.w;

		vec3 dest_cam = win_to_cam(vec3(gl_FragCoord.xy, initial_depth));
		float dist = distance(pos_cam, dest_cam);

		vec4 end_sh0 = frx_shadowViewMatrix * frx_inverseViewMatrix * vec4(dest_cam, 1.0);
		vec3 end_sh = end_sh0.xyz / end_sh0.w;

		float stp = 0.2;

		for(float i = -2; i <= 2; i+=stp) {
			float i0 = i + stp * hash13(uvec3(gl_FragCoord.xy, (frx_renderSeconds + i) * 1000.0));

			float t = exp(i0) / exp(2);
			vec3 cur_sh = mix(begin_sh, end_sh, t);
			sun_light += fog_color(
				mat3(frx_inverseViewMatrix) * mix(pos_cam, dest_cam, t)
			) * sun_light_at_shadow_pos(cur_sh) * dist * t;
		}
	}

	fb_traversal_result result = fb_traversal_result(
		initial_depth >= 1.0 ? TRAVERSAL_OUT_OF_FB : TRAVERSAL_SUCCESS,
		fb_pos(uvec2(gl_FragCoord.xy), vec2(0.5), initial_depth)
	);

	int stp = 0;
	bool success;
	bool under;
	bool out_of_fb;

	for(;true; ++stp) {
		// check ray trace result
		success = result.code == TRAVERSAL_SUCCESS;
		under = result.code == TRAVERSAL_POSSIBLY_UNDER;
		out_of_fb = result.code == TRAVERSAL_OUT_OF_FB;

		// fail branch
		if(!success) {
			--stp;
			break;
		}

		// success branch
		// swith to new pos
		pos = result.pos;
		vec3 prev_pos_cam = pos_cam;
		pos_cam = win_to_cam(vec3(pos.texel + pos.inner, pos.z));

		// prev reflection dir is now incidence
		vec3 incidence_cam = dir_cam;

		vec4 extras = texelFetch(u_extras_0, ivec2(pos.texel), 0);
		float roughness = extras.x;
		float block_light = extras.z;
		float sky_light = extras.y;

		vec3 geometric_normal_cam = texelFetch(u_normals, ivec2(pos.texel), 0).xyz;
		if(dot(geometric_normal_cam, geometric_normal_cam) < 0.4) {
			break;
		}
		geometric_normal_cam = normalize(geometric_normal_cam);

		vec3 normal_cam = compute_normal(incidence_cam, geometric_normal_cam, pos.texel, roughness);

		// update reflection dir
		dir_cam = normalize(
			reflect(
				incidence_cam,
				normal_cam
			)
		);

		vec3 color = pow(texelFetch(u_colors, ivec2(pos.texel), 0).rgb, vec3(2.2));

		lights[stp] = vec3(1.0) * pow(block_light * 1.23, 16.0);
		colors[stp] = color;

		if(frx_worldIsOverworld == 1) {
			float d = sun_light_at(pos_cam);
			float dt = max(dot(sun_dir(), normalize(mat3(frx_inverseViewMatrix) * normal_cam)), 0.0);

			vec3 sun = d * dt * sky_color(sun_dir());
			vec3 sky = sky_color(mat3(frx_inverseViewMatrix) * dir_cam);

			if(pos.z < 1.0) {
				sky *= pow(sky_light, 8.0);
			}

			sky_lights[stp] += sun + sky;
			sky_lights[stp] *= roughness;
		}

		if(stp == max_step_index) {
			break;
		}

		// traverse, check results at next iteration
		pos.z -= (0.00001 + roughness * 0.00001) * pow(2, stp);

		result = traverse_fb(
			pos,
			cam_dir_to_win(pos_cam, dir_cam),
			cam_dir_to_ndc(pos_cam, dir_cam),
			u_hi_depths,
			u_depths,
			u_win_normals
		);
	}

	vec3 light = vec3(0.0);

	if(frx_worldIsOverworld == 1) {
		light = sky_color(mat3(frx_inverseViewMatrix) * dir_cam);
		if(result.pos.z < 1.0) {
			vec4 extras = texelFetch(u_extras_0, ivec2(pos.texel), 0);
			float roughness = extras.x;
			float sky_light = extras.y;
			light *= pow(fix_light_value(sky_light), 8.0) * (1.0 - roughness);
		}
	}

	while(stp >= 0) {
		//--stp;
		light = colors[stp] * (light + sky_lights[stp] + lights[stp]);
		--stp;
	}

	float ratio = 0.0F;

	vec3 current_ndc = win_to_ndc(vec3(gl_FragCoord.xy, initial_depth));
	vec3 current_cam = ndc_to_cam(current_ndc);
	vec4 current_world0 = frx_inverseViewMatrix * vec4(current_cam, 1.0);
	vec3 current_world = current_world0.xyz / current_world0.w;

	vec4 prev_ndc0 = frx_lastViewProjectionMatrix * vec4(current_world + (frx_cameraPos - frx_lastCameraPos), 1.0);
	vec3 prev_ndc = prev_ndc0.xyz  / prev_ndc0.w;
	vec3 prev_win = ndc_to_win(prev_ndc);

	vec3 current_color = pow(sun_light + light, vec3(1.0 / 2.2));

	vec3 prev_color = max(texture(u_accum_0, prev_ndc.xy * 0.5 + 0.5).rgb, vec3(0.0));
	float prev_depth = texelFetch(u_accum_0, ivec2(prev_win.xy), 0).w;

	prev_win.z = prev_depth;

	prev_ndc = win_to_ndc(prev_win);

	vec4 prev_world0 = inverse(frx_lastViewProjectionMatrix) * vec4(prev_ndc, 1.0);
	vec3 prev_world = prev_world0.xyz / prev_world0.w;

	prev_world -= (frx_cameraPos - frx_lastCameraPos);

	if(
		texelFetch(u_extras_0, ivec2(gl_FragCoord.xy), 0).x == 0.0 ||
		any(greaterThan(prev_ndc.xyz, vec3(1.0))) || any(lessThan(prev_ndc.xyz, vec3(-1.0)))) {
		ratio = 1.0;
	} else {
		float prev_t = texelFetch(u_accum_0, ivec2(0), 0).w;
		ratio = 0.1 + distance(current_world, prev_world) / (frx_renderSeconds - prev_t) / 60.0;
		ratio = clamp(ratio, 0.0, 1.0);
	}

	out_color = vec4(
		mix(
			prev_color,
			current_color,
			ratio
		),
		uvec2(gl_FragCoord.xy) == uvec2(0) ? frx_renderSeconds : initial_depth
	);
}