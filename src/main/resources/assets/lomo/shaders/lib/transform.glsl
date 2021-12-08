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
	vec3 pos_c = cam_to_win(pos_cs, projMat);
	vec3 pos_dir_c = cam_to_win(pos_cs + dir_cs*0.1, projMat);

	vec3 X = pos_dir_c - pos_c;
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


mat3 rotation(float angle, vec3 v) {
	float a = angle;
	float c = cos(a);
	float s = sin(a);

	vec3 axis = vec3(v);
	vec3 temp = vec3((1. - c) * axis);

	mat3 r = mat3(0);
	r[0][0] = c + temp[0] * axis[0];
	r[0][1] = temp[0] * axis[1] + s * axis[2];
	r[0][2] = temp[0] * axis[2] - s * axis[1];

	r[1][0] = temp[1] * axis[0] - s * axis[2];
	r[1][1] = c + temp[1] * axis[1];
	r[1][2] = temp[1] * axis[2] + s * axis[0];

	r[2][0] = temp[2] * axis[0] + s * axis[1];
	r[2][1] = temp[2] * axis[1] - s * axis[0];
	r[2][2] = c + temp[2] * axis[2];

	return r;
}