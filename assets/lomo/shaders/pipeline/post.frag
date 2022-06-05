#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/fog.glsl
#include frex:shaders/lib/math.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/sky.glsl
#include lomo:shaders/lib/ray_plane.glsl
#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/lib/traverser.glsl

#include lomo:shaders/pipeline/post/compute_normal.glsl
#include lomo:shaders/pipeline/post/shadow.glsl

/* lomo:post.frag */

uniform sampler2D u_colors;
uniform sampler2D u_normals;
uniform sampler2D u_extras_0;
uniform sampler2D u_extras_1;
uniform sampler2D u_depths;
uniform sampler2D u_win_normals;
uniform sampler2D u_hi_depths;
uniform sampler2D u_accum;
uniform sampler2D u_color_depth;

layout(location = 0) out vec4 out_accum_next;
layout(location = 1) out vec4 out_color_and_depth_next;
layout(location = 2) out vec4 out_color;

struct light_info {
	vec3 light;
	vec3 color;
	vec3 pos_cam;
	vec3 prev_pos_cam;
	//vec2 win_pos;
	//vec3 dir_cam;
	//float dist;
	//float depth;
	float roughness;
};

void main() {
	float initial_depth = texelFetch(u_depths, ivec2(gl_FragCoord.xy), 0).r;

	fb_pos pos = fb_pos(uvec2(gl_FragCoord.xy), vec2(0.5), 0.0);
	vec3 pos_cam = win_to_cam(vec3(gl_FragCoord.xy, 0.0));
	vec3 dir_cam = cam_dir_to_z1(gl_FragCoord.xy);

	fb_traversal_result result = fb_traversal_result(
		initial_depth >= 1.0 ? TRAVERSAL_OUT_OF_FB : TRAVERSAL_SUCCESS,
		fb_pos(uvec2(gl_FragCoord.xy), vec2(0.5), initial_depth)
	);

	int stp = 0;

	vec3 normal_cam;
	vec3 geometric_normal_cam;
	float roughness;
	float sky_light;
	fb_pos prev_pos;

	const int steps = 2;
	light_info lights[steps + 1];

	for(int i = 0; i < steps + 1; ++i) {
		lights[i] = light_info(
			vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), 0.0
		);
	}

	for(;true;) {
		bool success   = result.code == TRAVERSAL_SUCCESS;
		bool under     = result.code == TRAVERSAL_POSSIBLY_UNDER;
		bool out_of_fb = result.code == TRAVERSAL_OUT_OF_FB;

		prev_pos = pos;
		pos = result.pos;
		lights[stp].prev_pos_cam = pos_cam;
		pos_cam = win_to_cam(vec3(ivec2(pos.texel) + pos.inner, pos.z));

		//lights[stp].depth = pos.z;
		lights[stp].pos_cam = pos_cam;
		//lights[stp].dir_cam = dir_cam;
		//lights[stp].dist = distance(pos_cam, prev_pos_cam);
		//lights[stp].win_pos = vec2(ivec2(pos.texel) + pos.inner);

		if(!success) {
			break;
		}

		geometric_normal_cam = texelFetch(u_normals, ivec2(pos.texel), 0).xyz;
		if(dot(geometric_normal_cam, geometric_normal_cam) < 0.4) {
			normal_cam = vec3(0.0);
			break;
		}

		vec4 extras = texelFetch(u_extras_0, ivec2(pos.texel), 0);
		roughness = extras.x;
		sky_light = extras.y;
		float block_light = extras.z;

		vec3 color = texelFetch(u_colors, ivec2(pos.texel), 0).rgb;
		color = pow(color, vec3(2.2));
		lights[stp].color = color;
		lights[stp].roughness = roughness;
		lights[stp].light = color * block_light;

		geometric_normal_cam = normalize(geometric_normal_cam);
		normal_cam = compute_normal(
			dir_cam, geometric_normal_cam, pos.texel, roughness
		);
		dir_cam = normalize(reflect(dir_cam, normal_cam));

		++stp;

		if(dot(dir_cam, geometric_normal_cam) < 0 || stp == steps) {
			break;
		}

		// traverse, check results at next iteration
		pos.z -= (0.00001 + roughness * 0.00001) * pow(2, stp);

		result = traverse_fb(
			pos,
			cam_dir_to_win(pos_cam, dir_cam), cam_dir_to_ndc(pos_cam, dir_cam),
			u_hi_depths, u_depths, u_win_normals,
			uint(mix(40, 80, (1.0 - roughness)))
		);
	}

	int sky_stp = stp;

	if(
		(normal_cam != vec3(0.0) || pos.z >= 1.0 || pos.z <= 0.0) &&
		frx_worldHasSkylight == 1
	) {
		vec3 s = sky(mat3(frx_inverseViewMatrix) * dir_cam);
		if(stp > 0) {
			lights[stp].roughness = roughness;
			lights[stp].prev_pos_cam = lights[stp - 1].pos_cam;
			s *= 2.0;
			vec3 sd = sun_dir();
			float d = sun_light_at(pos_cam);
			float dt = dot(
				sd,
				mat3(frx_inverseViewMatrix) *
				mix(normal_cam, geometric_normal_cam, 1.0) // still can't decide
			);
			dt = max(dt, 0.0);
			vec3 sun = d * dt * sky(sd) * float(sd.y > 0.0);
			s += sun * roughness * (1.0 - frx_smoothedRainGradient);
			s *= pow(sky_light, 4.0);
			if(result.code == TRAVERSAL_POSSIBLY_UNDER) { // TODO hack
				s *= pow((1.0 - roughness), 4.0);
			}
		}
		lights[stp].light = s;
	}

	vec3 light = vec3(0.0);

	for(;stp > 0;) {
		light = light * lights[stp].color + lights[stp].light;
		--stp;
	}

	dvec3 r_pos_cam = dvec3(lights[1].pos_cam);
	dvec3 r_prev_pos_cam = dvec3(lights[1].prev_pos_cam);
	dvec3 r_pos_wrd = cam_to_wrd(r_pos_cam);
	dvec3 r_prev_pos_wrd = cam_to_wrd(r_prev_pos_cam);
	r_pos_wrd += dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos);
	r_prev_pos_wrd += dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos);
	r_pos_cam = transform_pos(
		r_pos_wrd, dmat4(frx_lastViewMatrix)
	);
	r_prev_pos_cam = transform_pos(
		r_prev_pos_wrd, dmat4(frx_lastViewMatrix)
	);
	dvec3 r_pos_ndc = transform_pos(
		r_pos_cam, dmat4(frx_lastProjectionMatrix)
	);
	dvec3 r_prev_pos_ndc = transform_pos(
		r_prev_pos_cam, dmat4(frx_lastProjectionMatrix)
	);
	dvec3 r_pos_win = ndc_to_win(r_pos_ndc);
	dvec3 r_prev_pos_win = ndc_to_win(r_prev_pos_ndc);

	float accum_count_reversed =
		texelFetch(u_accum, ivec2(r_prev_pos_win.xy), 0).w;

	int accum_count =  int(1.0 / max(accum_count_reversed, 0.00001));

	accum_count = max(0, accum_count);

	vec4 prev_pos_cam_and_depth =
		texelFetch(u_color_depth, ivec2(r_prev_pos_win.xy), 0);

	dvec3 prev_pos_cam = dvec3(prev_pos_cam_and_depth.xyz);

	float prev_depth = prev_pos_cam_and_depth.w;

	if(
		any(greaterThan(vec3(r_prev_pos_ndc), vec3( 1.0))) ||
		any(lessThan   (vec3(r_prev_pos_ndc), vec3(-1.0)))
	) {
		accum_count = 0;
	}
	else if(abs(prev_depth - r_prev_pos_win.z) > 0.0004) {
		accum_count = 2;
	}

	if(sky_stp > 1) {
		float d = float(dot(
			normalize(prev_pos_cam - r_prev_pos_cam),
			normalize(r_pos_cam - r_prev_pos_cam)
		));

		d -= 1.0;
		d /= 32.0 * lights[0].roughness;

		accum_count = int(pow(float(accum_count), exp(d)) + 0.5);
	}

	accum_count = min(accum_count, int(512.0 * lights[0].roughness));
	accum_count += 1;

	vec3 prev_accum = texture(
		u_accum, vec2(r_prev_pos_ndc.xy * 0.5 + 0.5)
	).rgb;

	prev_accum = max(vec3(0.0), prev_accum);

	light =  mix(prev_accum, light, 1.0 / float(accum_count));

	out_accum_next = vec4(light, 1.0 / float(accum_count));
	out_color_and_depth_next = vec4(lights[1].pos_cam, initial_depth);

	light = light * lights[0].color + lights[0].light;
	light = pow(light, vec3(1.0 / 2.2));

	out_color = vec4(light, 1.0);
}