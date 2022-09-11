#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl

/* lomo:pipeline/post/compute_normal.glsl */

vec3 compute_normal(
	vec3 incidence, vec3 geometric_normal, vec2 pos, float roughness, uint stp
) {
	float r = PI;
	vec2 rand = hash24(uvec4(
		pos, frx_renderFrames % 4096, stp
		//abs(dvec3(frx_cameraPos + (frx_inverseViewMatrix * vec4(pos_cam, 1.0)).xyz) * 2048.0)
	));
	if(dot(-incidence, geometric_normal) < 0) geometric_normal *= -1;
	float x = (rand.x * 2.0 - 1.0); // [-1:1]
	float s = sign(x);
	x *= pow(
			abs(x),
			1.0 / (pow(roughness * 2, 4.0)) + 1.0 - 1.0 / 16.0
		) * 2048 * s;
	x *= r;
	vec3 new_normal = rotation(
		x, normalize(cross(-incidence, geometric_normal))
	) * geometric_normal;
	float cosa = dot(-incidence, geometric_normal);
	float angle = acos(cosa);
	float max_angle = PI - angle;
	float g = min(r, max_angle);
	if(x > g) {
		cosa = g / x;
	}
	else {
		cosa = 1.0;
	}
	max_angle = acos(cosa);
	float y = max_angle + (PI - max_angle) * (rand.y * 2.0);
	return rotation(y, geometric_normal) * new_normal;
}