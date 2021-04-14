#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:lib/transform.frag */

// win to ndc
vec2 win_xy_to_ndc(vec2 win_xy) {
	return (win_xy / frxu_size) * 2.0 - 1.0;
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
	return ((ndc_xy + 1.0) / 2.0) * frxu_size;
}

float ndc_z_to_win(float ndc_z) {
	return (ndc_z + 1.0) / 2.0;
}

vec3 ndc_to_win(vec3 ndc) {
	return vec3(
		ndc_to_win(ndc.xy),
		ndc_z_to_win(ndc.z)
	);
}

// cam to ndc
float cam_z_to_ndc(float cam_z, mat4 m) {
	return (cam_z * m[2][2] + m[3][2]) / (-cam_z);
}

vec3 cam_to_ndc(vec3 cam, mat4 m) {
	vec2 xy = vec2(
		cam.x * m[0][0] + cam.z * m[2][0],
		cam.y * m[1][1] + cam.z * m[2][1]
	);

	xy /= -cam.z;
	
	return vec3(xy, cam_z_to_ndc(cam.z, m));
}

// ndc to cam
float ndc_z_to_cam(float ndc_z, mat4 m) {
	return -m[3][2] / (m[2][2] + ndc_z);
}

vec2 ndc_xy_to_cam(vec2 ndc_xy, float cam_z, mat4 proj) {
	return vec2(
		(-cam_z * (ndc_xy.x + proj[2][0])) / proj[0][0],
		(-cam_z * (ndc_xy.y + proj[2][1])) / proj[1][1]
	);
}

vec3 ndc_to_cam(vec3 ndc, mat4 proj) {
	float cam_z = ndc_z_to_cam(ndc.z, proj);
	return vec3(ndc_xy_to_cam(ndc.xy, cam_z, proj), cam_z);
}

// win to cam
float win_z_to_cam(float win_z, mat4 m) {
	return ndc_z_to_cam(win_z_to_ndc(win_z), m);
}

vec3 win_to_cam(vec3 win, mat4 m) {
	return ndc_to_cam(win_to_ndc(win), m);
}

// cam to win
float cam_z_to_win(float cam_z, mat4 m) {
	return ndc_z_to_win(cam_z_to_ndc(cam_z, m));
}

vec3 cam_to_win(vec3 cam, mat4 m) {
	return ndc_to_win(cam_to_ndc(cam, m));
}

float near(mat4 proj) {
	return -ndc_z_to_cam(-1, proj);
}

float far(mat4 proj) {
	return -ndc_z_to_cam(1, proj);
}

vec2 near_far(mat4 proj) {
	return vec2(near(proj), far(proj));
}

float near_far_distance(mat4 proj) {
	return far(proj)-near(proj);
}

float linearalize_win_z(float win_z, mat4 proj) {
	float cam_z = win_z_to_cam(win_z, proj);

	vec2 nf = near_far(proj);
	float dist_from_near = -cam_z - nf[0];

	float nf_diff = nf[1] - nf[0];
	return dist_from_near / nf_diff;
}

vec3 cam_dir_to_win(vec3 pos_cs, vec3 dir_cs, mat4 proj) {
	vec3 a = cam_to_win(pos_cs, proj);
	vec3 b = cam_to_win(pos_cs + dir_cs*10, proj);
	return normalize(
		b - a
	);
}