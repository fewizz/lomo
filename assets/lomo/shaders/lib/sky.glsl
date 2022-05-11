#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/lib/noise/noise3d.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/ray_sphere.glsl
#include lomo:shaders/lib/ray_plane.glsl
#include lomo:shaders/lib/hash.glsl

/* lomo:lib/sky.glsl */

struct layer {
	float bottom;
	float height;
};

float ray_layer_intersection(ray r, layer l) {
	sphere top_sphere = sphere(vec3(0.0, -6000000.0, 0.0), 6000000.0 + l.bottom + l.height);
	sphere bot_sphere = sphere(vec3(0.0, -6000000.0, 0.0), 6000000.0 + l.bottom);
	
	ray_sphere_intersection_result top = ray_sphere_intersection(r, top_sphere);

	if(top.success && top.far > 0) {
		return top.far;
	}
	
	return 0.0;
}

const int steps = 10;

float od_integration(vec3 po, vec3 dir, float dist, layer l) {
	float stp = dist / float(steps);
	po += dir * stp / 2.0;

	float result = 0;

	for(int i = 0; i < steps; ++i) {
		result += exp(-((po.y - l.bottom)/l.height)) * stp;
		po += dir * stp;
	}

	return result;
}

vec3 sun_dir() {
	float t = frx_skyAngleRadians + 3.14 / 2.0;
	return vec3(cos(t), sin(t), 0);
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
					od_integration(r0.pos, sun_dir(), dist0, l)
					+
					od_integration(r.pos, r.dir, dist, l)
				)
			) * stp;
		dist += stp;
	};
	return result * coeffs;
}

vec3 sky_color(vec3 dir) {
	vec3 eye_pos = frx_cameraPos;
	ray eye = ray(eye_pos, dir);
	float a = dot(dir, sun_dir());
	vec3 rgb = pow(vec3(7.2, 5.7, 4.2), vec3(4.0));

	vec3 color = sky(
		eye,
		layer(0.0, 8000.0),
		0.04 / rgb
	);

	float sun = 0.0;
	float sun_a = 0.9999;
	float h = 0.0003;

	if(a > sun_a) {
		sun = 1.0;
	}
	else if(a > sun_a - h) {
		sun = (a - (sun_a - h)) / h;
	}

	color /= 2.0;
	color += color * vec3(4.0, 3.0, 1.0) * 20.0 * sun;
	return color;
}