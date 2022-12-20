#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl
#include lomo:shaders/lib/transform.glsl

vec3 sun_dir() {
	float t = frx_skyAngleRadians + PI / 2.0;
	return rotation(20.0 / 180.0 * PI, vec3(1.0, 0.0, 0.0)) * vec3(cos(t), sin(t), 0);
}