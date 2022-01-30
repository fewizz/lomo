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

vec3 compute_normal(vec3 incidence, vec3 geometric_normal, vec2 pos_win_xy, float reflectivity) {
	float r = (1. - reflectivity) * 3.1416 / 2.0;
	vec2 rand = hash23(uvec3(pos_win_xy, frx_renderSeconds * 1000.0));

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

void main() {
	const int steps = 2;
	const int max_step_index = steps - 1;
	vec3 lights[steps];
	vec3 colors[steps];

	for(int i = 0; i < steps; ++i) {
		lights[i] = vec3(0.0);
		colors[i] = vec3(0.0);
	}

	fb_pos pos = fb_pos(
		ufp16vec2_from_vec2(gl_FragCoord.xy),
		0.0
	);

	vec3 pos_cam = cam_near(gl_FragCoord.xy);
	vec3 dir_cam = cam_dir_to_z1(gl_FragCoord.xy);

	float initial_depth = texelFetch(u_depths, ivec2(gl_FragCoord.xy), 0).r;

	fb_traversal_result result = fb_traversal_result(
		initial_depth >= 1.0 ? TRAVERSAL_OUT_OF_FB : TRAVERSAL_SUCCESS,
		fb_pos(ufp16vec2_from_vec2(gl_FragCoord.xy), initial_depth)
	);

	int stp = 0;

	for(;true; ++stp) {
		// check ray trace result
		bool success = result.code == TRAVERSAL_SUCCESS;
		bool under = result.code == TRAVERSAL_POSSIBLY_UNDER;
		bool out_of_fb = result.code == TRAVERSAL_OUT_OF_FB;

		// fail branch
		if(out_of_fb || under) {
			lights[stp] = sky_color(mat3(frx_inverseViewMatrix) * dir_cam);

			if(result.pos.z < 1.0) {
				vec4 extras = texelFetch(u_extras_0, ivec2(outer_as_uvec2(pos.texel)), 0);
				lights[stp] *= pow(extras.y, 4.0);
			}

			break;
		}

		// success branch
		// swith to new pos
		pos = result.pos;
		vec3 prev_pos_cam = pos_cam;
		pos_cam = win_to_cam(vec3(ufp16vec2_as_vec2(pos.texel), pos.z));

		// for texture access
		uvec2 uxy = outer_as_uvec2(pos.texel);

		// prev reflection dir is now incidence
		vec3 incidence_cam = dir_cam;

		vec4 extras = texelFetch(u_extras_0, ivec2(uxy), 0);
		float reflectivity = extras.x;
		float block_light = extras.z;
		float sky_light = extras.y;

		vec3 geometric_normal_cam = texelFetch(u_normals, ivec2(uxy), 0).xyz;
		geometric_normal_cam = normalize(geometric_normal_cam);

		vec3 normal_cam = compute_normal(incidence_cam, geometric_normal_cam, ufp16vec2_as_vec2(pos.texel), reflectivity);

		// update reflection dir
		dir_cam = normalize(
			reflect(
				incidence_cam,
				normal_cam
			)
		);
		vec3 dir_win = cam_dir_to_win(pos_cam, dir_cam);

		vec3 color = pow(texelFetch(u_colors, ivec2(uxy), 0).rgb, vec3(2.2));

		lights[stp] = color*pow(block_light, 4.0);
		colors[stp] = color;

		// done, leaving
		if(stp == max_step_index) {
			/*vec4 world = frx_inverseViewMatrix * vec4(pos_cam, 1.0);
			vec4 shadow_pos_cam = frx_shadowViewMatrix * world;
			int cascade = select_shadow_cascade(shadow_pos_cam.xyz);

			vec4 shadow_pos_proj = frx_shadowProjectionMatrix(cascade) * shadow_pos_cam;
			shadow_pos_proj.xyz /= shadow_pos_proj.w;

			vec3 shadow_tex = shadow_pos_proj.xyz * 0.5 + 0.5;
			float d = texture(u_shadow_map, vec4(shadow_tex.xy, cascade, shadow_tex.z));
			float dt = max(dot(sun_dir(), normalize(mat3(frx_inverseViewMatrix) * normal_cam)), 0.0);
			lights[stp] += d * dt * sky_color(sun_dir());*/

			vec3 sky = sky_color(mat3(frx_inverseViewMatrix) * dir_cam);

			if(pos.z < 1.0) {
				sky *= pow(sky_light, 4.0);
			}

			lights[stp] += sky;

			break;
		}

		// traverse, check results at next iteration
		result = traverse_fb(
			pos, dir_win,
			u_hi_depths,
			u_depths,
			u_win_normals
		);
	}

	vec3 color = lights[stp];

	while(stp > 0) {
		--stp;
		color =  colors[stp] * (color + lights[stp]);
	}

	out_color = vec4(
		mix(
			max(texelFetch(u_accum_0, ivec2(gl_FragCoord.xy), 0).rgb, vec3(0.0)),
			pow(color, vec3(1.0 / 2.2)),
			0.5
		),
		1.0
	);
}