#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl
#include lomo:shaders/lib/linear.glsl
#include lomo:shaders/lib/hash.glsl

vec3 sun_dir() {
	float t = frx_skyAngleRadians + PI / 2.0;
	return rotation(
		20.0 / 180.0 * PI,
		vec3(1.0, 0.0, 0.0)
	) * vec3(cos(t), sin(t), 0);
}

vec3 sky(vec3 dir) {
	float sun = (1.0 - smoothstep(
		PI / 256.0,
		PI / 128.0,
		acos(dot(dir, sun_dir()))
	));

	//return vec3(1.0);
	return
		mix(
			vec3(0.05, 0.3, 1.0) * 2.0 * (2.0 - dir.y) / 2.0 *
			((sun_dir().y + 1.0) / 2.0 + 0.1) / 1.1,
			vec3(1.0, 0.8, 0.3) * 6000.0,
			sun
		) *
		(dir.y < 0.0 ? pow(1.0 - abs(dir.y), 8.0) : 1.0) +
		// stars
		max(0.0, hash23(uvec3(ivec3(dir * 1000.0))).x - 0.999) * 1000.0 * (-sun_dir().y + 1.0) / 2.0;
}