#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl
#include lomo:shaders/lib/sky.glsl
#include lomo:shaders/lib/blend.glsl
#include lomo:shaders/lib/ray_plane.glsl
#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/lib/traverser.glsl

/* lomo:post.frag */

uniform sampler2DArray u_colors;
uniform sampler2DArray u_normals;
uniform sampler2DArray u_extras_0;
uniform sampler2DArray u_extras_1;
uniform sampler2DArray u_depths;
uniform sampler2DArray u_win_normals;
uniform sampler2DArray u_hi_depths;
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
	vec2 rand = hash23(vec3(pos_win_xy, frx_renderSeconds));

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
	const int steps = 3;
	const int max_step_index = steps - 1;
	vec3 lights[steps];
	vec3 colors[steps];
	vec3 sky_lights[steps];
	vec3 sun_lights[steps];

	float initial_depth = texelFetch(u_depths, ivec3(gl_FragCoord.xy, 0), 0).r;

	fb_pos pos = fb_pos(
		ufp16vec2_from_vec2(gl_FragCoord.xy),
		0.0
	);

	vec3 pos_cam = cam_near(gl_FragCoord.xy);
	vec3 dir_cam = cam_dir_to_z1(gl_FragCoord.xy);

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
			lights[stp] = vec3(0.0);
			sun_lights[stp] = vec3(0.0);
			sky_lights[stp] = sky_color(mat3(frx_inverseViewMatrix) * dir_cam);

			if(result.pos.z < 1.0) {
				vec4 extras = texelFetch(u_extras_0, ivec3(outer_as_uvec2(pos.m), 0), 0);
				sky_lights[stp] *= extras.y * extras.y;
			}

			break;
		}

		// success branch
		// swith to new pos
		pos = result.pos;
		vec3 prev_pos_cam = pos_cam;
		pos_cam = win_to_cam(vec3(ufp16vec2_as_vec2(pos.m), pos.z));

		// for texture access
		uvec2 uxy = outer_as_uvec2(pos.m);

		// prev reflection dir is now incidence
		vec3 incidence_cam = dir_cam;

		vec4 extras = texelFetch(u_extras_0, ivec3(uxy, 0), 0);
		float reflectivity = extras.x;
		float block_light = extras.z;
		float sky_light = extras.y;

		vec3 geometric_normal_cam = texelFetch(u_normals, ivec3(uxy, 0), 0).xyz;
		//if(length(geometric_normal_cam) < 0.5) {
		//	break;
		//}
		geometric_normal_cam = normalize(geometric_normal_cam);

		vec3 normal_cam = compute_normal(incidence_cam, geometric_normal_cam, ufp16vec2_as_vec2(pos.m), reflectivity);

		// update reflection dir
		dir_cam = normalize(
			reflect(
				incidence_cam,
				normal_cam
			)
		);
		vec3 dir_win = cam_dir_to_win(pos_cam, dir_cam);

		vec3 light = vec3(0.0);
		vec3 color = pow3(texelFetch(u_colors, ivec3(uxy, 0), 0).rgb, 2.2);

		float dist = distance(prev_pos_cam, pos_cam) / 1000000.0;
		light = fog_color(mat3(frx_inverseViewMatrix) * dir_cam, dist) * sky_light * sky_light;
		sky_lights[stp] = sky_color(mat3(frx_inverseViewMatrix) * dir_cam) * sky_light * sky_light;

		vec4 world = frx_inverseViewMatrix * vec4(pos_cam, 1.0);
		vec4 shadow_pos_cam = frx_shadowViewMatrix * world;
		int cascade = select_shadow_cascade(shadow_pos_cam.xyz);

		vec4 shadow_pos_proj = frx_shadowProjectionMatrix(cascade) * shadow_pos_cam;
		shadow_pos_proj.xyz /= shadow_pos_proj.w;

		vec3 shadow_tex = shadow_pos_proj.xyz * 0.5 + 0.5;
		float d = texture(u_shadow_map, vec4(shadow_tex.xy, cascade, shadow_tex.z));
		float dt = clamp(dot(sun_dir(), normalize(mat3(frx_inverseViewMatrix) * normal_cam)), 0.0, 1.0);
		sun_lights[stp] = d * dt * sky_color(sun_dir());

		lights[stp] = light + color*pow(block_light, 4);
		colors[stp] = color*(1.0 - pow(block_light, 4));

		// we're done, leaving
		if(stp == max_step_index) {
			break;
		}

		// traverse, check results at next iteration
		result = traverse_fb(
			pos, dir_win,
			u_hi_depths,
			u_depths,
			u_win_normals,
			0u
		);
	}

	float steps_were_made = float(stp + 1);

	vec3 color = lights[stp] + sky_lights[stp] / steps_were_made;

	while(stp > 0) {
		--stp;
		color =  colors[stp] * (
			color
			+
			lights[stp]
			+
			sky_lights[stp] / steps_were_made
			+
			(steps_were_made > 1 ? sun_lights[stp] / (steps_were_made - 1) : vec3(0.0))
		);
	}

	out_color = vec4(
		mix(
			max(texelFetch(u_accum_0, ivec2(gl_FragCoord.xy), 0).rgb, vec3(0.0)),
			pow3(color, 1.0 / 2.2),
			0.5
		),
		1.0
	);
}