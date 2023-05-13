#include frex:shaders/api/view.glsl

mat3 rotation(float angle, vec3 v) {
	float c = cos(angle);
	float s = sin(angle);

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

vec3 win_to_cam(vec3 win) {
	vec3 ndc = win / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
	vec4 cam0 = frx_inverseProjectionMatrix * vec4(ndc, 1.0);
	return cam0.xyz / cam0.w;
}