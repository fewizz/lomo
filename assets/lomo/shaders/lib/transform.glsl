#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:lib/transform.frag */

vec2 win_to_ndc(vec2 win_xy) {
	return (win_xy / vec2(frxu_size)) * 2.0 - 1.0;
}

dvec2 win_to_ndc(dvec2 win_xy) {
	return (win_xy / dvec2(frxu_size)) * 2.0 - 1.0;
}

float win_z_to_ndc(float win_z) {
	return win_z * 2.0 - 1.0;
}

double win_z_to_ndc(double win_z) {
	return win_z * double(2.0) - double(1.0);
}

vec3 win_to_ndc(vec3 win) {
	return vec3(win_to_ndc(win.xy), win_z_to_ndc(win.z));
}

dvec3 win_to_ndc(dvec3 win) {
	return dvec3(win_to_ndc(win.xy), win_z_to_ndc(win.z));
}

// ndc to win
vec2 ndc_to_win(vec2 ndc_xy) {
	return (ndc_xy * 0.5 + 0.5) * vec2(frxu_size);
}

dvec2 ndc_to_win(dvec2 ndc_xy) {
	return (ndc_xy * 0.5 + 0.5) * dvec2(frxu_size);
}

float ndc_z_to_win(float ndc_z) {
	return ndc_z * 0.5 + 0.5;
}

double ndc_z_to_win(double ndc_z) {
	return ndc_z * 0.5 + 0.5;
}

vec3 ndc_to_win(vec3 ndc) {
	return vec3(ndc_to_win(ndc.xy), ndc_z_to_win(ndc.z));
}

dvec3 ndc_to_win(dvec3 ndc) {
	return dvec3(ndc_to_win(ndc.xy), ndc_z_to_win(ndc.z));
}

vec3 transform_pos(vec3 v, mat4 m) {
	vec4 v0 = m * vec4(v, 1.0);
	return v0.xyz / v0.w;
}

dvec3 transform_pos(dvec3 v, dmat4 m) {
	dvec4 v0 = m * dvec4(v, 1.0);
	return v0.xyz / v0.w;
}

vec3 cam_to_ndc(vec3 cam) {
	return transform_pos(cam, frx_projectionMatrix);
}

vec3 ndc_to_cam(vec3 ndc) {
	return transform_pos(ndc, frx_inverseProjectionMatrix);
}

dvec3 ndc_to_cam(dvec3 ndc) {
	return transform_pos(ndc, dmat4(frx_inverseProjectionMatrix));
}

vec3 win_to_cam(vec3 win) {
	return ndc_to_cam(win_to_ndc(win));
}

dvec3 win_to_cam(dvec3 win) {
	return ndc_to_cam(win_to_ndc(win));
}

vec3 cam_to_win(vec3 cam) {
	return ndc_to_win(cam_to_ndc(cam));
}

vec3 cam_dir_to_win(vec3 pos_cs, vec3 dir_cs, mat4 projMat) {
	dvec4 p = dvec4(pos_cs, 1.);
	dvec4 n = dvec4(dir_cs, 0.);
	n*=.1;

	dvec4 X = (dmat4(projMat) * (p + n));
	dvec4 Y = (dmat4(projMat) * p);

	dvec3 r = normalize(
		dvec3(
			frxu_size,
			1.0//gl_DepthRange.diff
		) * (
			(X.xyz / X.w)
			-
			(Y.xyz / Y.w)
		)
	);

	return vec3(r);
}

vec3 cam_dir_to_ndc(vec3 pos_cs, vec3 dir_cs, mat4 projMat) {
	vec4 p = vec4(pos_cs, 1.);
	vec4 n = vec4(dir_cs, 0.);
	n*=0.1;

	vec4 X = (projMat * (p + n));
	vec4 Y = (projMat * p);

	return normalize(
		(X.xyz / X.w)
		-
		(Y.xyz / Y.w)
	);
}

vec3 cam_dir_to_win(vec3 pos_cs, vec3 dir_cs) {
	return cam_dir_to_win(pos_cs, dir_cs, frx_projectionMatrix);
}

vec3 cam_dir_to_ndc(vec3 pos_cs, vec3 dir_cs) {
	return cam_dir_to_ndc(pos_cs, dir_cs, frx_projectionMatrix);
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

vec3 win_near(vec2 xy) {
	return vec3(xy, gl_DepthRange.near);
}

vec3 cam_near(vec2 xy) {
	return win_to_cam(win_near(xy));
}

vec3 win_far(vec2 xy) {
	return vec3(xy, gl_DepthRange.far);
}

vec3 cam_far(vec2 xy) {
	return win_to_cam(win_far(xy));
}

vec3 cam_dir_to_z1(vec2 xy) {
	return normalize(cam_far(xy) - cam_near(xy));
}

vec3 wrd_to_cam(vec3 wrd) {
	return transform_pos(wrd, frx_viewMatrix);
}

vec3 wrd_to_ndc(vec3 wrd) {
	return transform_pos(wrd, frx_viewProjectionMatrix);
}

vec3 wrd_to_win(vec3 wrd) {
	return ndc_to_win(wrd_to_ndc(wrd));
}

vec3 cam_to_wrd(vec3 cam) {
	return transform_pos(cam, frx_inverseViewMatrix);
}

dvec3 cam_to_wrd(dvec3 cam) {
	return transform_pos(cam, dmat4(frx_inverseViewMatrix));
}