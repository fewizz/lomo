#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:lib/transform.frag */

vec2 win_to_ndc(vec2 w) {
	return (w / frxu_size) * 2 - 1;
}

vec2 ndc_to_win(vec2 w) {
	return ((w + 1) / 2) * frxu_size;
}

float z_win_to_ndc(float zw) {
	return zw * 2 - 1;
}

float z_ndc_to_win(float zd) {
	return (zd + 1) / 2;
}

float z_cam_to_win(float z, mat4 m) {
	return z_ndc_to_win( (z*m[2][2] + m[3][2]) / -z );
}

float z_ndc_to_cam(float z_ndc, mat4 m) {
	return -m[3][2] / (m[2][2] + z_ndc);
}

float z_win_to_cam(float z_win, mat4 m) {
	float z_ndc = z_win_to_ndc(z_win);
	return z_ndc_to_cam(z_ndc, m);
}

vec3 win_to_cam(vec3 w, mat4 m) {
	vec2 ndc = vec2(win_to_ndc(w.xy));

	float z = z_win_to_cam(w.z, m);
	float x = (-z * (ndc.x + m[2][0])) / m[0][0];
	float y = (-z * (ndc.y + m[2][1])) / m[1][1];

	return vec3(x, y, z);
}

vec3 cam_to_win(vec3 w, mat4 m) {
	float xc = w.x * m[0][0] + w.z * m[2][0];
	float yc = w.y * m[1][1] + w.z * m[2][1];
	float zc = w.z * m[2][2] + m[3][2];
	
	vec3 ndc = vec3(xc, yc, zc)/(-w.z);

	return vec3(ndc_to_win(ndc.xy), z_ndc_to_win(ndc.z));
}

vec2 dir_cam_to_win(vec3 pos, vec3 dir, mat4 proj) {
	// black magic that took me 1 hour
	return normalize(
		vec2(
			( dir.x - dir.z * pos.x / pos.z ) * frxu_size.x * proj[0][0],
			( dir.y - dir.z * pos.y / pos.z ) * frxu_size.y * proj[1][1]
		)
	);

}

vec2 near_far(mat4 proj) {
	float near = -z_ndc_to_cam(-1, proj);
	float far = -z_ndc_to_cam(1, proj);
	return vec2(near, far);
}

float linearalize_z_win(float z_win, mat4 proj) {
	float z_cam = z_win_to_cam(z_win, proj);

	vec2 nf = near_far(proj);
	float dist_from_near = -(z_cam + nf[0]);

	float nf_diff = nf[1] - nf[0];
	return dist_from_near / nf_diff;
}