#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/lib/noise/noise3d.glsl

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
	float r = 3.1416 / 2.0;
	vec2 rand = hash23(uvec3(frx_renderSeconds * 1000.0, pos_win_xy));

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

vec3 fog(vec3 begin, vec3 end) {
	float dist = distance(begin, end);

	vec4 begin_sh0 = frx_shadowViewMatrix * frx_inverseViewMatrix * vec4(begin, 1.0);
	vec3 begin_sh = begin_sh0.xyz / begin_sh0.w;

	vec4 end_sh0 = frx_shadowViewMatrix * frx_inverseViewMatrix * vec4(end, 1.0);
	vec3 end_sh = end_sh0.xyz / end_sh0.w;

	float stp = 0.2;

	vec3 result = vec3(0);

	for(float i = -2; i <= 2; i+=stp) {
		float i0 = i + stp * hash13(uvec3(gl_FragCoord.xy, (frx_renderSeconds + i) * 1000.0));

		float t = exp(i0) / exp(2);
		vec3 cur_sh = mix(begin_sh, end_sh, t);

		vec3 fc = fog_color(
			mat3(frx_inverseViewMatrix) * mix(begin, end, t)
		);

		result += fc * sun_light_at_shadow_pos(cur_sh) * dist * t;
	}

	return result;
}

void main() {
	const int steps = 2;
	vec3 lights[steps + 1];
	vec3 colors[steps + 1];

	for(int i = 0; i < steps + 1; ++i) {
		lights[i] = vec3(0.0);
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

	fb_traversal_result result = fb_traversal_result(
		initial_depth >= 1.0 ? TRAVERSAL_OUT_OF_FB : TRAVERSAL_SUCCESS,
		fb_pos(uvec2(gl_FragCoord.xy), vec2(0.5), initial_depth)
	);

	int stp = 0;

	vec3 normal_cam;
	float roughness;
	float sky_light;
	fb_pos prev_pos;
	vec3 prev_pos_cam;

	for(;true;) {
		bool success   = result.code == TRAVERSAL_SUCCESS;
		bool under     = result.code == TRAVERSAL_POSSIBLY_UNDER;
		bool out_of_fb = result.code == TRAVERSAL_OUT_OF_FB;

		prev_pos = pos;
		pos = result.pos;

		prev_pos_cam = pos_cam;
		pos_cam = win_to_cam(vec3(pos.texel + pos.inner, pos.z));

		bool end = !success || stp == steps;

		if(frx_worldIsOverworld == 1) {
			if(!end) {
				lights[stp] += fog(prev_pos_cam, pos_cam);
			}

			if(end) {
				vec3 light = sky_color(mat3(frx_inverseViewMatrix) * dir_cam);
				if(stp > 0) {
					float d = sun_light_at(pos_cam);
					float dt = max(dot(sun_dir(), normalize(mat3(frx_inverseViewMatrix) * normal_cam)), 0.0);
					vec3 sun = d * dt * sky_color(sun_dir());
					light += sun * roughness;
					light *= pow(sky_light, 8.0);
					if(under && roughness > 0) { // TODO hack
						light *= 0.2;
					}
				}
				lights[stp] += light;
			}
		}

		if(end) {
			break;
		}

		vec4 extras = texelFetch(u_extras_0, ivec2(pos.texel), 0);
		roughness = extras.x;
		sky_light = extras.y;
		float block_light = extras.z;

		colors[stp] += pow(texelFetch(u_colors, ivec2(pos.texel), 0).rgb, vec3(2.2));
		lights[stp] += colors[stp] * block_light;

		vec3 geometric_normal_cam = texelFetch(u_normals, ivec2(pos.texel), 0).xyz;
		if(dot(geometric_normal_cam, geometric_normal_cam) < 0.4) {
			break;
		}
		geometric_normal_cam = normalize(geometric_normal_cam);
		normal_cam = compute_normal(dir_cam, geometric_normal_cam, pos.texel, roughness);

		dir_cam = normalize(
			reflect(
				dir_cam,
				normal_cam
			)
		);

		if(stp == steps - 1) {
			++stp;
			continue;
		}

		// traverse, check results at next iteration
		++stp;
		pos.z -= (0.00001 + roughness * 0.00001) * pow(2, stp);

		result = traverse_fb(
			pos,
			cam_dir_to_win(pos_cam, dir_cam),
			cam_dir_to_ndc(pos_cam, dir_cam),
			u_hi_depths,
			u_depths,
			u_win_normals,
			uint(mix(30, 100, 1.0 - roughness))
		);
	}

	vec3 light = lights[stp];
	--stp;

	while(stp >= 0) {
		light = lights[stp] + colors[stp] * light;
		--stp;
	}

	float ratio = 0.0F;

	vec3 current_ndc = win_to_ndc(vec3(gl_FragCoord.xy, initial_depth));
	vec3 current_cam = ndc_to_cam(current_ndc);
	vec4 current_world0 = frx_inverseViewMatrix * vec4(current_cam, 1.0);
	vec3 current_world = current_world0.xyz / current_world0.w;

	vec4 prev_ndc0 = frx_lastViewProjectionMatrix * vec4(dvec3(current_world) + (dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos)), 1.0);
	vec3 prev_ndc = prev_ndc0.xyz  / prev_ndc0.w;
	vec3 prev_win = ndc_to_win(prev_ndc);

	vec3 current_color = pow(light, vec3(1.0 / 2.2));

	vec3 prev_color = max(texture(u_accum_0, vec2(prev_ndc.xy * 0.5 + 0.5)).rgb, vec3(0.0));
	float prev_depth = texelFetch(u_accum_0, ivec2(prev_win.xy), 0).w;

	prev_win.z = prev_depth;

	prev_ndc = win_to_ndc(prev_win);

	vec4 prev_world0 = inverse(frx_lastViewProjectionMatrix) * vec4(prev_ndc, 1.0);
	vec3 prev_world = prev_world0.xyz / prev_world0.w;

	prev_world -= vec3(dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos));

	if(any(greaterThan(prev_ndc.xyz, vec3(1.0))) || any(lessThan(prev_ndc.xyz, vec3(-1.0)))) {
		ratio = 1.0;
	} else {
		float prev_t = texelFetch(u_accum_0, ivec2(0), 0).w;
		float r = texelFetch(u_extras_0, ivec2(gl_FragCoord.xy), 0).x;
		ratio = 1.0 - pow(r, 0.1);
		ratio = clamp(
			ratio,
			0.05 + distance(current_world, prev_world) / (frx_renderSeconds - prev_t) / 40.0,
			1.0
		);
	};

	out_color = vec4(
		mix(
			prev_color,
			current_color,
			ratio
		),
		uvec2(gl_FragCoord.xy) == uvec2(0) ? frx_renderSeconds : initial_depth
	);
}