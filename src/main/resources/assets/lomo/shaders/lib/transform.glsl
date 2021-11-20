#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:lib/transform.frag */

vec2 win_xy_to_ndc(vec2 win_xy) {
	return (win_xy / vec2(frxu_size)) * 2.0 - 1.0;
}

float win_z_to_ndc(float win_z) {
	return win_z * 2.0 - 1.0;
}

vec3 win_to_ndc(vec3 win) {
	return vec3(
		win_xy_to_ndc(win.xy),
		win_z_to_ndc(win.z)
	);
}

// ndc to win
vec2 ndc_to_win(vec2 ndc_xy) {
	return (ndc_xy * 0.5 + 0.5) * vec2(frxu_size);
}

float ndc_z_to_win(float ndc_z) {
	return ndc_z * 0.5 + 0.5;
}

vec3 ndc_to_win(vec3 ndc) {
	return vec3(
		ndc_to_win(ndc.xy),
		ndc_z_to_win(ndc.z)
	);
}

vec4 cam_to_ndc(vec4 cam, mat4 projMat) {
	return projMat * cam;
}

vec4 cam_to_ndc(vec4 cam) {
	return cam_to_ndc(cam, frx_projectionMatrix);
}

vec3 cam_to_ndc(vec3 cam, mat4 projMat) {
	vec4 res = cam_to_ndc(vec4(cam, 1.0), projMat);
	return res.xyz / res.w;
}

vec3 cam_to_ndc(vec3 cam) {
	return cam_to_ndc(cam, frx_projectionMatrix);
}

vec3 ndc_to_cam(vec3 ndc, mat4 invProj) {
	vec4 v = invProj * vec4(ndc, 1.0);
	return v.xyz / v.w;
}

vec3 ndc_to_cam(vec3 ndc) {
	return ndc_to_cam(ndc, frx_inverseProjectionMatrix);
}

vec3 win_to_cam(vec3 win, mat4 invProj) {
	return ndc_to_cam(win_to_ndc(win), invProj);
}

vec3 win_to_cam(vec3 win) {
	return win_to_cam(win, frx_inverseProjectionMatrix);
}

vec3 cam_to_win(vec3 cam, mat4 projMat) {
	return ndc_to_win(cam_to_ndc(cam, projMat));
}

vec3 cam_to_win(vec3 cam) {
	return cam_to_win(cam, frx_projectionMatrix);
}

vec3 cam_dir_to_win(vec3 pos_cs, vec3 dir_cs, mat4 projMat) {
	vec4 pos_c = projMat * vec4(pos_cs, 1.0);
	vec4 pos_dir_c = projMat * vec4(pos_cs + dir_cs, 1.0);
	vec3 X =
		pos_dir_c.xyz / pos_dir_c.w
		-
		pos_c.xyz / pos_c.w;

	X.xy *= vec2(frxu_size);

	return normalize(X);
}

vec3 cam_dir_to_win(vec3 pos_cs, vec3 dir_cs) {
	return cam_dir_to_win(pos_cs, dir_cs, frx_projectionMatrix);
}

vec3 raw_normal_to_cam(vec3 raw_normal, mat4 viewMat) {
	return normalize(
		(mat3(viewMat) * raw_normal)
	);
}

vec3 raw_normal_to_cam(vec3 raw_normal) {
	return raw_normal_to_cam(raw_normal, frx_viewMatrix);
}