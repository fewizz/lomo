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
	return
		(
			vec3(0.4, 0.6, 1.0) * max(0.0, (dir.y + 1.0) / 2.0) +
			vec3(0.5) * (1.0 - abs(dir.y)) +
			vec3(1.0, 0.6, 0.4) * (1.0 - smoothstep(
				PI / 128.0,
				PI / 64.0,
				acos(dot(dir, sun_dir()))
			))
		) *
		mix(
			vec3(1.0),
			vec3(1.0, 0.4, 0.2),
			pow(1.0 - abs(sun_dir().y), 4.0)
		) *
		((sun_dir().y + 1.0) / 2.0 + 0.1) / 1.1;
}