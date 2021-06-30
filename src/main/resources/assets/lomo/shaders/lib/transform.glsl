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

vec4 cam_to_ndc(vec4 cam) {
	return frx_projectionMatrix() * cam;
}

vec3 cam_to_ndc(vec3 cam) {
	vec4 res = cam_to_ndc(vec4(cam, 1.0));
	return res.xyz / res.w;
}

vec3 ndc_to_cam(vec3 ndc) {
	vec4 v = frx_inverseProjectionMatrix() * vec4(ndc, 1.0);
	return v.xyz / v.w;
}

vec3 win_to_cam(vec3 win) {
	return ndc_to_cam(win_to_ndc(win));
}

vec3 cam_to_win(vec3 cam) {
	return ndc_to_win(cam_to_ndc(cam));
}

vec4 mat_row(mat4 m, int r) {
	return vec4(m[0][r], m[1][r], m[2][r], m[3][r]);
}

// some dark magic
// TODO broken
vec3 cam_dir_to_win(vec3 pos_cs, vec3 dir_cs) {
	mat4 proj = frx_projectionMatrix();

	vec4 las_row = mat_row(proj, 3);

	float aw = dot(vec4(pos_cs, 1.0), las_row);
	float bw = dot(vec4(dir_cs, 0.0), las_row);

	vec4 res = proj * vec4(-bw * pos_cs + dir_cs * aw, -bw);

	return normalize(
		vec3(
			res.xy * frxu_size,
			res.z
		)
	);
}

vec3 raw_normal_to_cam(vec3 raw_normal) {
	return normalize(
		mat3(frx_viewMatrix()) * raw_normal
	);
}