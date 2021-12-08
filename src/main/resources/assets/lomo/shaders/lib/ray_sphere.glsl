#include lomo:shaders/lib/ray.glsl
#include lomo:shaders/lib/sphere.glsl

/* lomo:lib/ray_sphere.glsl */

struct ray_sphere_intersection_result {
	bool success;
	float close;
	float far;
};

ray_sphere_intersection_result ray_sphere_intersection(ray r, sphere s) {
	vec3 diff = r.pos - s.pos;

	float a = dot(r.dir, r.dir);
	float b = 2.0*dot(diff, r.dir);
	float c = dot(diff, diff) - s.rad * s.rad;

	float d = b*b - 4.0*a*c;

	if(d >= 0.0) {
		float xl = (-b - sqrt(d)) / (2.0 * a);
		float xr = (-b + sqrt(d)) / (2.0 * a);
		return ray_sphere_intersection_result(true, xl, xr);
	}

	return ray_sphere_intersection_result(false, 0.0, 0.0);
} 