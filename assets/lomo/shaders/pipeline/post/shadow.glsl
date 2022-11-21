#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/pipeline/post/sun_dir.glsl

/* lomo:pipeline/post/shadow_glsl.glsl */

uniform sampler2DArrayShadow u_shadow_map;

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

float sun_light_at_shadow_pos(vec3 pos, int cascade) {
	vec4 shadow_pos_proj = frx_shadowProjectionMatrix(cascade) * vec4(pos, 1.0);
	shadow_pos_proj.xyz /= shadow_pos_proj.w;
	vec3 shadow_tex = shadow_pos_proj.xyz * 0.5 + 0.5;
	return texture(u_shadow_map, vec4(shadow_tex.xy, cascade, shadow_tex.z));
}

float sun_light_at_shadow_pos(vec3 pos) {
	int cascade = select_shadow_cascade(pos);
	return sun_light_at_shadow_pos(pos, cascade);
}

float sun_light_at_world_pos(vec3 pos, int cascade) {
	vec4 shadow_pos_cam = frx_shadowViewMatrix * vec4(pos, 1.0);
	return sun_light_at_shadow_pos(shadow_pos_cam.xyz / shadow_pos_cam.w, cascade);
}

float sun_light_at_world_pos(vec3 pos) {
	vec4 shadow_pos_cam = frx_shadowViewMatrix * vec4(pos, 1.0);
	return sun_light_at_shadow_pos(shadow_pos_cam.xyz / shadow_pos_cam.w);
}

float sun_light_at(vec3 pos) {
	vec4 world = frx_inverseViewMatrix * vec4(pos, 1.0);
	return sun_light_at_world_pos(world.xyz / world.w);
}

float sun_light_at(vec3 pos, int cascade) {
	vec4 world = frx_inverseViewMatrix * vec4(pos, 1.0);
	return sun_light_at_world_pos(world.xyz / world.w, cascade);
}