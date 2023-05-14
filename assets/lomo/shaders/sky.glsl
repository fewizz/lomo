#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl
#include lomo:shaders/lib/linear.glsl

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

	return
		mix(
			vec3(0.2, 0.4, 1.0) * 1.5 * (2.0 - dir.y) / 2.0 *
			((sun_dir().y + 1.0) / 2.0 + 0.1) / 1.1,

			vec3(1.0, 0.8, 0.3) * 24000.0,

			sun
		);
}