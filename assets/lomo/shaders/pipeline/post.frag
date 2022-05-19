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

/* lomo:post.frag */

uniform sampler2D u_colors;
uniform sampler2D u_normals;
uniform sampler2D u_extras_0;
uniform sampler2D u_extras_1;
uniform sampler2D u_depths;
uniform sampler2D u_win_normals;
uniform sampler2D u_hi_depths;
uniform sampler2D u_accum_prev;
uniform sampler2DArrayShadow u_shadow_map;

layout(location = 0) out vec4 out_indirect_light;
layout(location = 1) out vec4 out_color;

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

vec3 compute_normal(
	vec3 incidence, vec3 geometric_normal, vec2 pos_win_xy, float roughness
) {
	float r = PI / 2.0;
	vec2 rand = hash23(uvec3((frx_renderSeconds) * 1000.0, pos_win_xy));
	if(dot(-incidence, geometric_normal) < 0) geometric_normal *= -1;
	float x = (rand.x * 2.0 - 1.0);
	float s = sign(x);
	x = pow(abs(x), 0.3 / (roughness + 0.00001)) * s;
	x *= r;
	vec3 new_normal = rotation(
		x,
		normalize(cross(-incidence, geometric_normal))
	) * geometric_normal;
	float cosa = dot(-incidence, geometric_normal);
	float angle = acos(cosa);
	float max_angle = PI / 2.0 - angle;
	float g = min(r, max_angle);
	if(x > g) {
		cosa = g / x;
	}
	else {
		cosa = 1.0;
	}
	max_angle = acos(cosa);
	float y = max_angle + (PI - max_angle) * (rand.y * 2.0);
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

struct light_info {
	vec3 light;
	vec3 color;
	vec3 pos_cam;
	vec3 dir_cam;
	float dist;
};

void main() {
	float initial_depth = texelFetch(u_depths, ivec2(gl_FragCoord.xy), 0).r;
	float ratio = 0.0F;

	vec3 current_ndc = win_to_ndc(vec3(gl_FragCoord.xy, initial_depth));
	vec3 current_cam = ndc_to_cam(current_ndc);
	vec4 current_world0 = frx_inverseViewMatrix * vec4(current_cam, 1.0);
	vec3 current_world = current_world0.xyz / current_world0.w;

	vec4 prev_ndc0 =
		frx_lastViewProjectionMatrix *
		vec4(current_world + (frx_cameraPos - frx_lastCameraPos), 1.0);
	vec3 prev_ndc = prev_ndc0.xyz  / prev_ndc0.w;
	vec3 prev_win = ndc_to_win(prev_ndc);
	float prev_depth = texelFetch(u_accum_prev, ivec2(prev_win.xy), 0).w;
	prev_win.z = prev_depth;
	prev_ndc = win_to_ndc(prev_win);
	vec4 prev_world0 =
		inverse(frx_lastViewProjectionMatrix) *
		vec4(prev_ndc, 1.0);
	vec3 prev_world = prev_world0.xyz / prev_world0.w;
	prev_world -= vec3(dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos));

	if(
		any(greaterThan(prev_ndc.xyz, vec3( 1.0))) ||
		any(lessThan   (prev_ndc.xyz, vec3(-1.0)))
	) {
		ratio = 1.0;
	} else {
		float prev_t = texelFetch(u_accum_prev, ivec2(0), 0).w;
		float r = texelFetch(u_extras_0, ivec2(gl_FragCoord.xy), 0).x;
		ratio = 1.0 - pow(r, 0.04);
		ratio = clamp(ratio, 0.04, 1.0);
	};

	fb_pos pos = fb_pos(
		uvec2(gl_FragCoord.xy), vec2(0.5), 0.0
	);
	vec3 pos_cam = current_cam;
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
	vec3 prev_pos_cam;

	const int steps = 2;
	light_info lights[steps + 1];

	for(int i = 0; i < steps + 1; ++i) {
		lights[i] = light_info(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), 0.0);
	}

	for(;true;) {
		bool success   = result.code == TRAVERSAL_SUCCESS;
		bool under     = result.code == TRAVERSAL_POSSIBLY_UNDER;
		bool out_of_fb = result.code == TRAVERSAL_OUT_OF_FB;

		prev_pos = pos;
		pos = result.pos;
		prev_pos_cam = pos_cam;
		pos_cam = win_to_cam(vec3(ivec2(pos.texel) + pos.inner, pos.z));

		lights[stp].pos_cam = prev_pos_cam;
		lights[stp].dir_cam = dir_cam;
		lights[stp].dist = distance(pos_cam, prev_pos_cam);

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
		lights[stp].light = color * block_light;

		geometric_normal_cam = normalize(geometric_normal_cam);
		normal_cam = compute_normal(dir_cam, geometric_normal_cam, pos.texel, roughness);
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

	if((normal_cam != vec3(0.0) || pos.z >= 1.0) && frx_worldHasSkylight == 1) {
		if(result.code != TRAVERSAL_SUCCESS) lights[stp].dist = 10000000.0;
		lights[stp].pos_cam = prev_pos_cam;
		lights[stp].dir_cam = dir_cam;
		vec3 s = sky(mat3(frx_inverseViewMatrix) * dir_cam);
		if(stp > 0) {
			s *= 10.0;
			vec3 sd = sun_dir();
			float d = sun_light_at(pos_cam);
			float dt = dot(
				sd,
				mat3(frx_inverseViewMatrix) *
				mix(normal_cam, geometric_normal_cam, 1.0) // still can't decide
			);
			dt = max(dt, 0.0);
			vec3 sun = d * dt * sky(sd);
			s += sun;// * roughness * (1.0 - frx_smoothedRainGradient);
			s *= pow(sky_light, 8.0);
			if(result.code == TRAVERSAL_POSSIBLY_UNDER) { // TODO hack
				s *= (1.0 - roughness);
			}
		}
		lights[stp].light = s;
	}

	vec3 light = vec3(0.0);
	while(stp >= 1) {
		light = light * lights[stp].color + lights[stp].light;
		--stp;
	}

	light_info light0 = lights[0];

	vec3 prev_accum = texture(u_accum_prev, vec2(prev_ndc.xy * 0.5 + 0.5)).rgb;
	prev_accum = max(prev_accum, vec3(0.0));
	prev_accum = pow(prev_accum, vec3(2.2));

	vec3 accum = mix(prev_accum, light, ratio);

	out_indirect_light = vec4(
		pow(accum, vec3(1.0 / 2.2)),
		initial_depth
	);

	light = accum * light0.color + light0.light;
	light = pow(light, vec3(1.0 / 2.2));
	out_color = vec4(light, 1.0);
}