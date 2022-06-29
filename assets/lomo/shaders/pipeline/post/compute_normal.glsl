#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl

vec3 compute_normal(
	vec3 incidence, vec3 geometric_normal, vec2 pos_win_xy, float roughness
) {
	float r = PI / 2.0;
	vec2 rand = hash23(uvec3(frx_renderFrames, pos_win_xy));
	if(dot(-incidence, geometric_normal) < 0) geometric_normal *= -1;
	float x = (rand.x * 2.0 - 1.0); // [-1:1]
	float s = sign(x);
	x = pow(abs(x), 1.0 / (roughness + 0.000005)) * s;
	x *= r; // [-PI/2 : PI/2]
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