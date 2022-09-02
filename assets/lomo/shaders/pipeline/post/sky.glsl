#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/lib/math.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/ray_sphere.glsl
#include lomo:shaders/lib/ray_plane.glsl
#include lomo:shaders/lib/hash.glsl

/* lomo:pipeline/post/sky.glsl */

struct layer {
	float bottom;
	float height;
};

const float e_rad = 600000.0;

float ray_layer_intersection(ray r, layer l) {
	sphere top_sphere = sphere(
		vec3(0.0, -e_rad, 0.0), e_rad + l.bottom + l.height
	);
	sphere bot_sphere = sphere(
		vec3(0.0, -e_rad, 0.0), e_rad + l.bottom
	);
	ray_sphere_intersection_result top = ray_sphere_intersection(r, top_sphere);
	if(top.success && top.far > 0) {
		return top.far;
	}
	return 0.0;
}

const int steps = 4;

float od_integration(vec3 po, vec3 dir, float dist, layer l) {
	float stp = dist / float(steps);
	po += dir * stp / 2.0;
	float result = 0;
	for(int i = 0; i < steps; ++i) {
		float dist = distance(po, vec3(0.0, -e_rad, 0.0)) - e_rad - l.bottom;
		result += exp(-dist/l.height) * stp;
		po += dir * stp;
	}
	return result;
}

vec3 sun_dir() {
	float t = frx_skyAngleRadians + PI / 2.0;
	return vec3(cos(t), sin(t), 0);
}

float henyey_greenstein_phase_function(float g, float cosa) {
	return 3.0*(1.0-g*g)/(2.0*(2.0+g*g)) * (1.0+cosa*cosa)/pow(1.0+g*g-2.0*g*cosa, 3.0/2.0);
}

vec3 sky(ray r, layer l, vec3 coeffs) {
	float dist = ray_layer_intersection(r, l);
	float stp = dist / float(steps);
	dist = stp / 2.0;
	vec3 result = vec3(0);
	for(int i = 0; i < steps; ++i) {
		ray r0 = ray(r.pos + r.dir * dist, sun_dir());
		float dist0 = ray_layer_intersection(r0, l);
		result +=
			exp(
				-coeffs * (
					od_integration(r0.pos, sun_dir(), dist0, l) +
					od_integration(r.pos, r.dir, dist, l)
				)
			) * stp;
		dist += stp;
	}
	return result * coeffs;
}

vec3 sky(vec3 dir, bool with_sun) {
	vec3 eye_pos = frx_cameraPos;
	eye_pos.x = 0.0; eye_pos.z = 0.0;
	ray eye = ray(eye_pos, dir);
	float a = dot(dir, sun_dir());
	vec3 rgb = pow(vec3(7.2, 5.7, 4.2), vec3(4.0));
	vec3 color = sky(eye, layer(0.0, 12000.0), 0.03 / rgb);
	vec3 s = sky(eye, layer(0.0, 20000.0), 0.05 / rgb) * henyey_greenstein_phase_function(0.6, a) * vec3(1.0, 0.5, 0.25) * 0.2;
	if(with_sun) {
		//float sun = 0.0;
		//float sun_a = 0.9999;
		float h = 0.0003;
		float sun = smoothstep(0.9999, 1.0, a);
		s += s * sun * vec3(200.0);
	}
	return (color + s) * 2.0;// * vec3(0.65, 1.0, 3.0) * 0.8;
}